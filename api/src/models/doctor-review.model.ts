import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Assessment } from './assessment.model';

export type ReviewDecision =
  | 'accept_consult'
  | 'route_physio'
  | 'route_other_specialty'
  | 'request_more_info'
  | 'decline';

/**
 * The doctor's verdict on each patient.
 *
 * This is the feedback loop for the rules: comparing `decision` and
 * `agreedWithTriage` against the machine's category is the only way to know
 * whether the filter actually works. See plan.md §10.
 */
@Table({ tableName: 'doctor_reviews', underscored: true })
export class DoctorReview extends Model<DoctorReview> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Assessment)
  @Column({ type: DataType.UUID, allowNull: false })
  declare assessmentId: string;

  @BelongsTo(() => Assessment)
  declare assessment?: Assessment;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare decision: ReviewDecision;

  /** Which specialty, when decision is route_other_specialty. */
  @Column(DataType.TEXT)
  declare routeTo: string | null;

  @Column(DataType.BOOLEAN)
  declare agreedWithTriage: boolean | null;

  @Column(DataType.TEXT)
  declare notes: string | null;

  @Column(DataType.TEXT)
  declare reviewedBy: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare reviewedAt: Date;
}
