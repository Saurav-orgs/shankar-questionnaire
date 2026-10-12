import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Assessment, TriageResult } from '../models';
import { findContradictions } from '../questionnaire/answer-validation';
import { progress } from '../questionnaire/evaluator';
import type {
  EvaluationContext,
  QuestionnaireSchema,
  TriageRule,
} from '../questionnaire/types';
import { evaluateRules, redFlagsFromSchema } from './rules-engine';
import { buildTemplateSummary, computeCompleteness } from './summary';

/**
 * Version of the deterministic summary template, recorded on every row so a
 * later change to the wording is traceable in stored results.
 */
const SUMMARY_VERSION = 'template-v1';

@Injectable()
export class TriageService {
  constructor(
    @InjectModel(TriageResult)
    private readonly triageResults: typeof TriageResult,
  ) {}

  /**
   * Evaluate rules, build the summary, and upsert the triage_results row.
   * Runs on submit and on the emergency early-submit. Idempotent: re-running
   * overwrites the existing result for the assessment.
   *
   * Every field here is derived deterministically from the patient's answers
   * and the questionnaire's own rules — the same input always produces the
   * same triage result and the same summary.
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

    const payload = {
      assessmentId: assessment.id,
      category: evaluation.category,
      urgency: evaluation.urgency,
      pathway: evaluation.pathway,
      score: evaluation.score,
      matchedRules: evaluation.matchedRules,
      redFlags,
      secondaryNotes: evaluation.secondaryNotes,
      contradictions,
      unmatched: evaluation.unmatched,
      completeness,
      summaryText: buildTemplateSummary(schema, context, evaluation, redFlags),
      summarySource: 'template' as const,
      model: null,
      promptVersion: SUMMARY_VERSION,
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
}
