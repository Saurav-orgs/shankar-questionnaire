import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, PatchAnswersDto, SetLanguageDto } from './dto';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  /**
   * Creating assessments is the abuse vector, not answering them — 20 per IP
   * per hour is generous for a clinic and hostile to a script.
   */
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post()
  create(@Body() dto: CreateAssessmentDto) {
    return this.assessments.create(dto.language, dto.consent);
  }

  @Get(':token')
  get(@Param('token') token: string, @Query('schema') schema?: string) {
    return this.assessments.getState(token, schema === 'true');
  }

  @Patch(':token/language')
  setLanguage(@Param('token') token: string, @Body() dto: SetLanguageDto) {
    return this.assessments.setLanguage(token, dto.language);
  }

  /** Autosave. Handles patient details and clinical answers through one path. */
  @Patch(':token/answers')
  patchAnswers(@Param('token') token: string, @Body() dto: PatchAnswersDto) {
    return this.assessments.patchAnswers(
      token,
      dto.answers,
      dto.currentQuestionKey,
    );
  }

  @Post(':token/submit')
  submit(@Param('token') token: string) {
    return this.assessments.submit(token);
  }
}
