import { Assessment } from './assessment.model';
import { AuditLog } from './audit-log.model';
import { Doctor } from './doctor.model';
import { DoctorReview } from './doctor-review.model';
import { QuestionnaireVersion } from './questionnaire-version.model';
import { TriageResult } from './triage-result.model';

export const models = [
  Doctor,
  QuestionnaireVersion,
  Assessment,
  TriageResult,
  DoctorReview,
  AuditLog,
];

export {
  Assessment,
  AuditLog,
  Doctor,
  DoctorReview,
  QuestionnaireVersion,
  TriageResult,
};
