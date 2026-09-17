import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  Assessment,
  DoctorReview,
  QuestionnaireVersion,
  TriageResult,
} from '../models';
import type { ReviewDecision } from '../models/doctor-review.model';
import { buildLabelLookup } from '../questionnaire/localize';
import type { AnswerValue } from '../questionnaire/types';

const URGENCY_RANK: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  routine: 2,
  non_urgent: 3,
};

export interface DashboardRow {
  id: string;
  patientName: string | null;
  patientAge: number | null;
  patientGender: string | null;
  patientMobile: string | null;
  mainComplaint: string | null;
  category: string | null;
  urgency: string | null;
  emergencyTriggered: boolean;
  redFlagCount: number;
  reviewed: boolean;
  submittedAt: Date | null;
}

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Assessment) private readonly assessments: typeof Assessment,
    @InjectModel(TriageResult)
    private readonly triageResults: typeof TriageResult,
    @InjectModel(DoctorReview)
    private readonly reviews: typeof DoctorReview,
    @InjectModel(QuestionnaireVersion)
    private readonly versions: typeof QuestionnaireVersion,
  ) {}

  async list(params: {
    category?: string;
    q?: string;
  }): Promise<DashboardRow[]> {
    const where: Record<string, unknown> = { status: 'submitted' };
    if (params.q) {
      where[Op.or as unknown as string] = [
        { patientName: { [Op.iLike]: `%${params.q}%` } },
        { patientMobile: { [Op.iLike]: `%${params.q}%` } },
      ];
    }

    const rows = await this.assessments.findAll({
      where,
      include: [{ model: TriageResult }],
      order: [['submittedAt', 'DESC']],
    });

    const reviewedIds = new Set(
      (
        await this.reviews.findAll({ attributes: ['assessmentId'] })
      ).map((r) => r.assessmentId),
    );

    const mapped: DashboardRow[] = rows
      .filter(
        (a) =>
          !params.category ||
          a.triageResult?.category === params.category,
      )
      .map((a) => {
        const version = null; // main-complaint label resolved below via answers
        void version;
        return {
          id: a.id,
          patientName: a.patientName,
          patientAge: a.patientAge,
          patientGender: a.patientGender,
          patientMobile: a.patientMobile,
          mainComplaint: this.mainComplaintCode(a),
          category: a.triageResult?.category ?? null,
          urgency: a.triageResult?.urgency ?? null,
          emergencyTriggered: a.emergencyTriggered,
          redFlagCount:
            a.triageResult?.redFlags?.filter(
              (f) => f.answer !== 'No' && f.answer !== 'Not answered',
            ).length ?? 0,
          reviewed: reviewedIds.has(a.id),
          submittedAt: a.submittedAt,
        };
      });

    // Sort by urgency, then most recent. Emergencies always float to the top.
    return mapped.sort((a, b) => {
      const ua = URGENCY_RANK[a.urgency ?? 'non_urgent'] ?? 9;
      const ub = URGENCY_RANK[b.urgency ?? 'non_urgent'] ?? 9;
      if (ua !== ub) return ua - ub;
      return (
        (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0)
      );
    });
  }

  private mainComplaintCode(a: Assessment): string | null {
    const primary = a.answers?.primary_complaint;
    if (typeof primary === 'string') return primary;
    const cc = a.answers?.chief_complaint;
    if (Array.isArray(cc) && cc.length) return String(cc[0]);
    return null;
  }

  async detail(id: string) {
    const assessment = await this.assessments.findByPk(id, {
      include: [{ model: TriageResult }],
    });
    if (!assessment) throw new NotFoundException('Assessment not found.');

    const version = await this.versions.findByPk(
      assessment.questionnaireVersionId,
    );
    if (!version) throw new NotFoundException('Questionnaire version not found.');

    const labels = buildLabelLookup(version.schema);
    const review = await this.reviews.findOne({
      where: { assessmentId: id },
      order: [['reviewedAt', 'DESC']],
    });

    // Render every answered question as English label + value, grouped by
    // section, so a Hindi-language submission reads entirely in English.
    const sections = version.schema.sections
      .slice()
      .sort((s1, s2) => s1.order - s2.order)
      .map((section) => ({
        key: section.key,
        title: section.title.en,
        items: version.schema.questions
          .filter((q) => q.section === section.key)
          .filter((q) => hasAnswer(assessment.answers?.[q.key]))
          .map((q) => ({
            key: q.key,
            question: q.text.en,
            answer: labels.answerLabel(q.key, assessment.answers?.[q.key]),
          })),
      }))
      .filter((s) => s.items.length > 0);

    return {
      id: assessment.id,
      patient: {
        name: assessment.patientName,
        age: assessment.patientAge,
        gender: assessment.patientGender,
        mobile: assessment.patientMobile,
        city: assessment.patientCity,
        occupation: assessment.patientOccupation
          ? labels.answerLabel('occupation', assessment.patientOccupation)
          : null,
      },
      language: assessment.language,
      status: assessment.status,
      emergencyTriggered: assessment.emergencyTriggered,
      submittedAt: assessment.submittedAt,
      triage: assessment.triageResult
        ? {
            category: assessment.triageResult.category,
            urgency: assessment.triageResult.urgency,
            pathway: assessment.triageResult.pathway,
            summaryText: assessment.triageResult.summaryText,
            summarySource: assessment.triageResult.summarySource,
            matchedRules: assessment.triageResult.matchedRules,
            redFlags: assessment.triageResult.redFlags,
            secondaryNotes: assessment.triageResult.secondaryNotes,
            contradictions: assessment.triageResult.contradictions,
            unmatched: assessment.triageResult.unmatched,
            completeness: assessment.triageResult.completeness,
          }
        : null,
      sections,
      review: review
        ? {
            decision: review.decision,
            routeTo: review.routeTo,
            agreedWithTriage: review.agreedWithTriage,
            notes: review.notes,
            reviewedAt: review.reviewedAt,
          }
        : null,
    };
  }

  async saveReview(
    id: string,
    input: {
      decision: ReviewDecision;
      routeTo?: string;
      agreedWithTriage?: boolean;
      notes?: string;
    },
  ) {
    const assessment = await this.assessments.findByPk(id);
    if (!assessment) throw new NotFoundException('Assessment not found.');

    return this.reviews.create({
      assessmentId: id,
      decision: input.decision,
      routeTo: input.routeTo ?? null,
      agreedWithTriage: input.agreedWithTriage ?? null,
      notes: input.notes ?? null,
      reviewedBy: 'doctor',
      reviewedAt: new Date(),
    } as Partial<DoctorReview> as DoctorReview);
  }

  async questionnaireLabels(versionId: string) {
    const version = await this.versions.findByPk(versionId);
    if (!version) throw new NotFoundException('Questionnaire version not found.');
    return { version: version.version, schema: version.schema };
  }
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
