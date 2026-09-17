import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import type { QuestionnaireSchema, TriageRule } from '../questionnaire/types';

export type QuestionnaireStatus = 'draft' | 'published' | 'archived';

@Table({ tableName: 'questionnaire_versions', underscored: true })
export class QuestionnaireVersion extends Model<QuestionnaireVersion> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  declare version: number;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare schema: QuestionnaireSchema;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare rules: TriageRule[];

  @Default('draft')
  @Column({ type: DataType.TEXT, allowNull: false })
  declare status: QuestionnaireStatus;

  @Column(DataType.DATE)
  declare publishedAt: Date | null;
}
