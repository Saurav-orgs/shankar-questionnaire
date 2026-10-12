import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Assessment, QuestionnaireVersion } from '../models';
import { DoctorsService } from '../doctors/doctors.service';
import {
  AnswerProblem,
  validateAnswer,
} from '../questionnaire/answer-validation';
import {
  hasEmergencyTrigger,
  isQuestionVisible,
  missingRequired,
  nextQuestion,
  progress,
} from '../questionnaire/evaluator';
import { localizeSchema, LocalizedSchema } from '../questionnaire/localize';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import type {
  AnswerMap,
  AnswerValue,
  EvaluationContext,
  Lang,
  QuestionnaireSchema,
} from '../questionnaire/types';
import { TriageService } from '../triage/triage.service';

/**
 * Questions whose answers live in dedicated columns rather than the answers
 * blob, so the doctor dashboard can sort and search on them. The patient app
 * still submits them through the same endpoint as every other question.
 */
const DETAIL_COLUMNS: Record<string, keyof Assessment> = {
  name: 'patientName',
  age: 'patientAge',
  gender: 'patientGender',
  mobile: 'patientMobile',
  city: 'patientCity',
  occupation: 'patientOccupation',
};

export interface AssessmentState {
  token: string;
  language: Lang;
  status: string;
  emergencyTriggered: boolean;
  answers: EvaluationContext;
  progress: { answered: number; total: number };
  nextQuestionKey: string | null;
  missingRequiredKeys: string[];
  schema?: LocalizedSchema;
}

/** Answers plus the detail columns, keyed as the schema sees them. */
export function buildEvaluationContext(
  assessment: Assessment,
): EvaluationContext {
  return {
    ...assessment.answers,
    name: assessment.patientName,
    age: assessment.patientAge,
    gender: assessment.patientGender,
    mobile: assessment.patientMobile,
    city: assessment.patientCity,
    occupation: assessment.patientOccupation,
  } as EvaluationContext;
}

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectModel(Assessment)
    private readonly assessments: typeof Assessment,
    private readonly questionnaireService: QuestionnaireService,
    private readonly doctorsService: DoctorsService,
    private readonly triageService: TriageService,
    private readonly config: ConfigService,
  ) {}

  private get emergencyInterruptEnabled(): boolean {
    return this.config.get<string>('EMERGENCY_INTERRUPT_ENABLED') !== 'false';
  }

  async create(language: Lang, consent: boolean): Promise<AssessmentState> {
    if (!consent) {
      throw new BadRequestException('Consent is required to begin.');
    }

    const doctor = await this.doctorsService.getPrimary();
    const version = await this.questionnaireService.getPublished();

    const assessment = await this.assessments.create({
      publicToken: randomBytes(24).toString('base64url'),
      doctorId: doctor.id,
      questionnaireVersionId: version.id,
      language,
      status: 'in_progress',
      consentAt: new Date(),
      answers: {},
    } as Partial<Assessment> as Assessment);

    return this.toState(assessment, version.schema);
  }

  private async load(token: string): Promise<{
    assessment: Assessment;
    version: QuestionnaireVersion;
  }> {
    const assessment = await this.assessments.findOne({
      where: { publicToken: token },
    });
    if (!assessment) throw new NotFoundException('Assessment not found.');

    const version = await this.questionnaireService.getById(
      assessment.questionnaireVersionId,
    );
    return { assessment, version };
  }

  private buildContext(assessment: Assessment): EvaluationContext {
    return buildEvaluationContext(assessment);
  }

  private toState(
    assessment: Assessment,
    schema: QuestionnaireSchema,
    localized?: LocalizedSchema,
  ): AssessmentState {
    const context = this.buildContext(assessment);
    return {
      token: assessment.publicToken,
      language: assessment.language,
      status: assessment.status,
      emergencyTriggered: assessment.emergencyTriggered,
      answers: context,
      progress: progress(schema, context),
      nextQuestionKey: nextQuestion(schema, context)?.key ?? null,
      missingRequiredKeys: missingRequired(schema, context).map((q) => q.key),
      ...(localized ? { schema: localized } : {}),
    };
  }

  async getState(
    token: string,
    includeSchema = false,
  ): Promise<AssessmentState> {
    const { assessment, version } = await this.load(token);

    if (!includeSchema) return this.toState(assessment, version.schema);

    const doctor = await this.doctorsService.getPrimary();
    const localized = localizeSchema(version.schema, assessment.language, {
      doctorName: doctor.fullName,
      clinicPhone: doctor.clinicPhone,
    });
    return this.toState(assessment, version.schema, localized);
  }

  async setLanguage(token: string, language: Lang): Promise<AssessmentState> {
    const { assessment, version } = await this.load(token);
    assessment.language = language;
    assessment.lastActivityAt = new Date();
    await assessment.save();
    return this.toState(assessment, version.schema);
  }

  async patchAnswers(
    token: string,
    incoming: Record<string, unknown>,
    currentQuestionKey?: string,
  ): Promise<AssessmentState & { emergency: boolean }> {
    const { assessment, version } = await this.load(token);

    if (assessment.status === 'submitted') {
      throw new ConflictException(
        'This assessment has already been submitted.',
      );
    }

    const schema = version.schema;
    const byKey = new Map(schema.questions.map((q) => [q.key, q]));
    const problems: AnswerProblem[] = [];

    // Validate everything before writing anything — a partial write on a
    // rejected batch would leave the record in a state the client did not
    // intend.
    const accepted: Array<[string, AnswerValue]> = [];

    for (const [key, rawValue] of Object.entries(incoming)) {
      const question = byKey.get(key);
      if (!question) {
        problems.push({ key, message: 'Unknown question.' });
        continue;
      }

      const value = rawValue as AnswerValue;
      const message = validateAnswer(question, value);
      if (message) {
        problems.push({ key, message });
        continue;
      }
      accepted.push([key, value]);
    }

    if (problems.length) {
      throw new BadRequestException({
        message: 'Some answers could not be accepted.',
        problems,
      });
    }

    const answers: AnswerMap = { ...assessment.answers };
    for (const [key, value] of accepted) {
      if (key in DETAIL_COLUMNS) {
        const column = DETAIL_COLUMNS[key];
        const stored =
          key === 'age' ? Number(value) : value === null ? null : String(value);
        (assessment as unknown as Record<string, unknown>)[column] = stored;
      } else {
        answers[key] = value;
      }
    }

    // Clear answers that a change has just hidden. Leaving them would let a
    // stale branch answer drive a triage rule the patient no longer qualifies
    // for — e.g. switching the complaint away from back pain while an old
    // "radiates below knee" answer lingers.
    assessment.answers = answers;
    const context = this.buildContext(assessment);
    for (const question of schema.questions) {
      if (question.key in DETAIL_COLUMNS) continue;
      if (!isQuestionVisible(question, context) && question.key in answers) {
        delete answers[question.key];
      }
    }

    assessment.answers = answers;
    assessment.changed('answers', true);
    if (currentQuestionKey) assessment.currentQuestionKey = currentQuestionKey;
    assessment.lastActivityAt = new Date();

    const triggers = this.emergencyInterruptEnabled
      ? hasEmergencyTrigger(schema, this.buildContext(assessment))
      : [];

    const emergencyJustFired =
      triggers.length > 0 && !assessment.emergencyTriggered;

    if (emergencyJustFired) {
      assessment.emergencyTriggered = true;
      // Push it to the doctor immediately, incomplete. A partial emergency
      // record is worth more than a complete routine one.
      assessment.status = 'submitted';
      assessment.submittedAt = new Date();
    }

    await assessment.save();

    if (emergencyJustFired) {
      await this.triageService.evaluateAndStore(
        assessment,
        version.schema,
        version.rules,
        this.buildContext(assessment),
      );
    }

    return {
      ...this.toState(assessment, schema),
      emergency: assessment.emergencyTriggered,
    };
  }

  async submit(token: string): Promise<AssessmentState> {
    const { assessment, version } = await this.load(token);

    if (assessment.status === 'submitted') {
      return this.toState(assessment, version.schema);
    }

    const context = this.buildContext(assessment);
    const missing = missingRequired(version.schema, context);

    if (missing.length) {
      throw new BadRequestException({
        message: 'Some required questions are unanswered.',
        problems: missing.map((q) => ({
          key: q.key,
          message: 'This question is required.',
        })),
      });
    }

    assessment.status = 'submitted';
    assessment.submittedAt = new Date();
    assessment.lastActivityAt = new Date();
    await assessment.save();

    await this.triageService.evaluateAndStore(
      assessment,
      version.schema,
      version.rules,
      context,
    );

    return this.toState(assessment, version.schema);
  }
}
