import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AssessmentsController } from './assessments/assessments.controller';
import { AssessmentsService } from './assessments/assessments.service';
import { DoctorsService } from './doctors/doctors.service';
import {
  Assessment,
  Doctor,
  QuestionnaireVersion,
  TriageResult,
} from './models';
import { QuestionnaireController } from './questionnaire/questionnaire.controller';
import { QuestionnaireService } from './questionnaire/questionnaire.service';
import { TriageService } from './triage/triage.service';

/**
 * The patient-facing surface: doctor profile, questionnaire delivery, and the
 * assessment lifecycle. Grouped in one module because they share the same
 * models and are always deployed together.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      Doctor,
      QuestionnaireVersion,
      Assessment,
      TriageResult,
    ]),
  ],
  controllers: [QuestionnaireController, AssessmentsController],
  providers: [
    QuestionnaireService,
    DoctorsService,
    AssessmentsService,
    TriageService,
  ],
  exports: [QuestionnaireService, DoctorsService, AssessmentsService],
})
export class PatientModule {}
