import { Controller, Get, Query } from '@nestjs/common';
import { DoctorsService } from '../doctors/doctors.service';
import { QuestionnaireService } from './questionnaire.service';
import type { Lang } from './types';

@Controller()
export class QuestionnaireController {
  constructor(
    private readonly questionnaire: QuestionnaireService,
    private readonly doctors: DoctorsService,
  ) {}

  @Get('doctor-profile')
  async doctorProfile(@Query('lang') lang?: string) {
    const doctor = await this.doctors.getPrimary();
    return this.doctors.toProfile(doctor, lang === 'hi' ? 'hi' : 'en');
  }

  @Get('questionnaire/active')
  async active(@Query('lang') lang?: string) {
    const language: Lang = lang === 'hi' ? 'hi' : 'en';
    const doctor = await this.doctors.getPrimary();
    return this.questionnaire.getLocalized(language, {
      doctorName: doctor.fullName,
      clinicPhone: doctor.clinicPhone,
    });
  }
}
