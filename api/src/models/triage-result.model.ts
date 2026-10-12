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
import type { TriageCategory, TriageUrgency } from '../questionnaire/types';
import { Assessment } from './assessment.model';

/**
 * Summaries are always built from the deterministic template. `'ai'` remains
 * only so rows written before the summary model was removed still type.
 */
export type SummarySource = 'ai' | 'template';

export interface MatchedRuleRecord {
  code: string;
  label: string;
  explain: string;
  /** Category rules only. */
  severity?: number;
  category?: TriageCategory;
  /** Scoring rules only. */
  points?: number;
}

export interface RedFlagRecord {
  key: string;
  label: string;
  answer: string;
}

@Table({ tableName: 'triage_results', underscored: true })
export class TriageResult extends Model<TriageResult> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Assessment)
  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  declare assessmentId: string;

  @BelongsTo(() => Assessment)
  declare assessment?: Assessment;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare category: TriageCategory;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare urgency: TriageUrgency;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare pathway: string;

  /** The SOP's administrative score. Null on rows triaged before it existed. */
  @Column(DataType.INTEGER)
  declare score: number | null;

  /** Every rule that fired, not just the winner — the doctor sees all of them. */
  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  declare matchedRules: MatchedRuleRecord[];

  /** Includes the negatives, so "all red flags answered no" is displayable. */
  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  declare redFlags: RedFlagRecord[];

  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  declare secondaryNotes: string[];

  /** e.g. reported no back pain but answered the back-pain branch. */
  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  declare contradictions: string[];

  /** True when no rule fired at all. Must stay visible, never silently GREEN. */
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare unmatched: boolean;

  @Column(DataType.DECIMAL(4, 3))
  declare completeness: number | null;

  @Column(DataType.TEXT)
  declare summaryText: string | null;

  @Column(DataType.TEXT)
  declare summarySource: SummarySource | null;

  @Column(DataType.TEXT)
  declare model: string | null;

  @Column(DataType.TEXT)
  declare promptVersion: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare generatedAt: Date;
}
