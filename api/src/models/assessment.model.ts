import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import type { AnswerMap, Lang } from '../questionnaire/types';
import { Doctor } from './doctor.model';
import { QuestionnaireVersion } from './questionnaire-version.model';
import { TriageResult } from './triage-result.model';

export type AssessmentStatus = 'in_progress' | 'submitted' | 'abandoned';
export type PatientGender = 'male' | 'female' | 'other';

@Table({ tableName: 'assessments', underscored: true })
export class Assessment extends Model<Assessment> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  /**
   * Opaque resume token used in patient URLs. Carries no patient identity —
   * see plan.md §12, "No PII in URLs".
   */
  @Column({ type: DataType.TEXT, allowNull: false, unique: true })
  declare publicToken: string;

  @ForeignKey(() => Doctor)
  @Column({ type: DataType.UUID, allowNull: false })
  declare doctorId: string;

  @BelongsTo(() => Doctor)
  declare doctor?: Doctor;

  @ForeignKey(() => QuestionnaireVersion)
  @Column({ type: DataType.UUID, allowNull: false })
  declare questionnaireVersionId: string;

  @BelongsTo(() => QuestionnaireVersion)
  declare questionnaireVersion?: QuestionnaireVersion;

  @Default('en')
  @Column({ type: DataType.TEXT, allowNull: false })
  declare language: Lang;

  @Default('in_progress')
  @Column({ type: DataType.TEXT, allowNull: false })
  declare status: AssessmentStatus;

  @Column(DataType.DATE)
  declare consentAt: Date | null;

  @Column(DataType.TEXT)
  declare patientName: string | null;

  @Column(DataType.INTEGER)
  declare patientAge: number | null;

  @Column(DataType.TEXT)
  declare patientGender: PatientGender | null;

  @Column(DataType.TEXT)
  declare patientMobile: string | null;

  @Column(DataType.TEXT)
  declare patientOccupation: string | null;

  @Column(DataType.TEXT)
  declare patientCity: string | null;

  /** Question key -> answer code(s). Shape is governed by the schema version. */
  @Default({})
  @Column({ type: DataType.JSONB, allowNull: false })
  declare answers: AnswerMap;

  @Column(DataType.TEXT)
  declare currentQuestionKey: string | null;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare emergencyTriggered: boolean;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare startedAt: Date;

  @Column(DataType.DATE)
  declare submittedAt: Date | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare lastActivityAt: Date;

  @HasOne(() => TriageResult)
  declare triageResult?: TriageResult;
}
