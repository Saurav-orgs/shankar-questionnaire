import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { ReviewDecision } from '../models/doctor-review.model';

export class DoctorAuthDto {
  @IsString()
  @MaxLength(100)
  passcode: string;
}

const DECISIONS: ReviewDecision[] = [
  'accept_consult',
  'route_physio',
  'route_other_specialty',
  'request_more_info',
  'decline',
];

export class ReviewDto {
  @IsIn(DECISIONS)
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  routeTo?: string;

  @IsOptional()
  @IsBoolean()
  agreedWithTriage?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
