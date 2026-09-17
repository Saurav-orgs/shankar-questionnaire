import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

/**
 * Every doctor-panel read of patient data lands here. This is health data with
 * names and phone numbers attached — who looked at what must be answerable.
 */
@Table({
  tableName: 'audit_logs',
  underscored: true,
  updatedAt: false,
})
export class AuditLog extends Model<AuditLog> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.TEXT)
  declare actor: string | null;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare action: string;

  @Column(DataType.TEXT)
  declare entity: string | null;

  @Column(DataType.UUID)
  declare entityId: string | null;

  @Column(DataType.TEXT)
  declare ip: string | null;

  @Column(DataType.TEXT)
  declare userAgent: string | null;
}
