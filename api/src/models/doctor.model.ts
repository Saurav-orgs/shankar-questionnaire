import {
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Assessment } from './assessment.model';

@Table({ tableName: 'doctors', underscored: true })
export class Doctor extends Model<Doctor> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare fullName: string;

  @Column(DataType.TEXT)
  declare qualifications: string | null;

  @Column(DataType.TEXT)
  declare specialty: string | null;

  @Column(DataType.TEXT)
  declare bioEn: string | null;

  @Column(DataType.TEXT)
  declare bioHi: string | null;

  @Column(DataType.TEXT)
  declare photoUrl: string | null;

  @Column(DataType.TEXT)
  declare clinicName: string | null;

  @Column(DataType.TEXT)
  declare clinicAddress: string | null;

  @Column(DataType.TEXT)
  declare clinicPhone: string | null;

  /** Shown on the emergency screen. The only number a patient is told to call. */
  @Column(DataType.TEXT)
  declare emergencyPhone: string | null;

  @HasMany(() => Assessment)
  declare assessments?: Assessment[];
}
