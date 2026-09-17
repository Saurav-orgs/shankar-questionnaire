import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAssessmentDto {
  @IsIn(['en', 'hi'])
  language: 'en' | 'hi';

  /** Must be true. Nothing about the patient is stored before this. */
  @IsBoolean()
  consent: boolean;
}

export class PatchAnswersDto {
  /**
   * Partial map of question key -> answer. Values are validated against the
   * questionnaire schema in the service, not here — class-validator cannot
   * express "must be one of this question's option codes".
   */
  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  currentQuestionKey?: string;
}

export class SetLanguageDto {
  @IsIn(['en', 'hi'])
  language: 'en' | 'hi';
}
