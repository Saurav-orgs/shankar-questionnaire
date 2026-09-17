import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Assessment,
  AuditLog,
  DoctorReview,
  QuestionnaireVersion,
  TriageResult,
} from '../models';
import { AuditService } from './audit.service';
import { DoctorAuthGuard, DoctorAuthService } from './doctor-auth';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

/**
 * The doctor review panel: passcode auth, triage-sorted dashboard, detail view,
 * and decision capture. Deployed separately from the patient surface (plan.md
 * §4) but shares the same models.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      Assessment,
      TriageResult,
      DoctorReview,
      QuestionnaireVersion,
      AuditLog,
    ]),
  ],
  controllers: [DoctorController],
  providers: [DoctorService, DoctorAuthService, DoctorAuthGuard, AuditService],
})
export class DoctorModule {}
