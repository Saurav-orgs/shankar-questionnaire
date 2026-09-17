import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Assessment, TriageResult } from '../models';
import { findContradictions } from '../questionnaire/answer-validation';
import { progress } from '../questionnaire/evaluator';
import type {
  EvaluationContext,
  QuestionnaireSchema,
  TriageRule,
} from '../questionnaire/types';
import { checkConstraints } from '../training/constraints';
import { classifyFreeTextScript } from './free-text-script';
import { renderModelInput } from './model-input';
import { evaluateRules, redFlagsFromSchema } from './rules-engine';
import { callSummaryModel } from './summary-model-client';
import { buildTemplateSummary, computeCompleteness } from './summary';

const PROMPT_VERSION = 'gemma-3-4b-lora-v1';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    @InjectModel(TriageResult)
    private readonly triageResults: typeof TriageResult,
    private readonly config: ConfigService,
  ) {}

  /**
   * Evaluate rules, build the summary, and upsert the triage_results row.
   * Runs on submit and on the emergency early-submit. Idempotent: re-running
   * overwrites the existing result for the assessment.
   */
  async evaluateAndStore(
    assessment: Assessment,
    schema: QuestionnaireSchema,
    rules: TriageRule[],
    context: EvaluationContext,
  ): Promise<TriageResult> {
    const evaluation = evaluateRules(rules, context);
    const redFlags = redFlagsFromSchema(schema, context);
    const contradictions = findContradictions(context);
    const { answered, total } = progress(schema, context);
    const completeness = computeCompleteness(answered, total);

    const { summaryText, summarySource, model } = await this.buildSummary(
      schema,
      context,
      evaluation,
      redFlags,
      contradictions,
      assessment.language,
    );

    const payload = {
      assessmentId: assessment.id,
      category: evaluation.category,
      urgency: evaluation.urgency,
      pathway: evaluation.pathway,
      matchedRules: evaluation.matchedRules,
      redFlags,
      secondaryNotes: evaluation.secondaryNotes,
      contradictions,
      unmatched: evaluation.unmatched,
      completeness,
      summaryText,
      summarySource,
      model,
      promptVersion: summarySource === 'ai' ? PROMPT_VERSION : 'template-v1',
      generatedAt: new Date(),
    };

    const existing = await this.triageResults.findOne({
      where: { assessmentId: assessment.id },
    });

    if (existing) {
      await existing.update(payload);
      return existing;
    }

    return this.triageResults.create(payload as Partial<TriageResult> as TriageResult);
  }

  /**
   * Tries the on-device model; falls back to the deterministic template on
   * any failure — disabled, unreachable, timeout, or an output that fails
   * the five §9 constraints. plan.md §9: "the doctor must never open a
   * patient and find an empty card," so every branch here ends in text.
   *
   * Never throws. A broken summary model degrades the doctor's read, not the
   * patient's ability to submit — evaluateAndStore must still complete.
   */
  private async buildSummary(
    schema: QuestionnaireSchema,
    context: EvaluationContext,
    evaluation: ReturnType<typeof evaluateRules>,
    redFlags: ReturnType<typeof redFlagsFromSchema>,
    contradictions: string[],
    language: 'en' | 'hi',
  ): Promise<{ summaryText: string; summarySource: 'ai' | 'template'; model: string | null }> {
    const template = () => ({
      summaryText: buildTemplateSummary(schema, context, evaluation, redFlags),
      summarySource: 'template' as const,
      model: null,
    });

    const enabled = this.config.get<string>('AI_SUMMARY_ENABLED') !== 'false';
    const baseUrl = this.config.get<string>('SUMMARY_MODEL_URL');
    if (!enabled || !baseUrl) return template();

    const timeoutMs = Number(this.config.get<string>('SUMMARY_MODEL_TIMEOUT_MS')) || 15000;
    const modelInput = renderModelInput(schema, context, evaluation, redFlags, contradictions, {
      language,
    });

    let result: Awaited<ReturnType<typeof callSummaryModel>>;
    try {
      result = await callSummaryModel(baseUrl, modelInput, timeoutMs);
    } catch (err) {
      // Timeout and connection failure are both routine here — the model can
      // be off, still loading, or just slow — so this logs at warn, not
      // error, and always falls through to the template rather than
      // propagating.
      this.logger.warn(
        `summary model unavailable, using template: ${(err as Error).message}`,
      );
      return template();
    }

    const violations = checkConstraints({
      output: result.output,
      input: modelInput,
      freeTextScript: classifyFreeTextScript(context.free_text as string | undefined),
      surgeryDetailScript: classifyFreeTextScript(
        context.tx_prior_surgery_detail as string | undefined,
      ),
    });

    if (violations.length) {
      this.logger.warn(
        `summary model output failed validation, using template: ${violations
          .map((v) => `${v.constraint} (${v.detail})`)
          .join('; ')}`,
      );
      return template();
    }

    return {
      summaryText: result.output,
      summarySource: 'ai',
      model: result.model ?? 'gemma-3-4b-it-4bit+lora',
    };
  }
}
