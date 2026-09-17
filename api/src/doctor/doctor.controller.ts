import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { DOCTOR_COOKIE, DoctorAuthGuard, DoctorAuthService } from './doctor-auth';
import { DoctorService } from './doctor.service';
import { DoctorAuthDto, ReviewDto } from './dto';

/** Single passcode user — no per-doctor identity in the POC (plan.md §15). */
const ACTOR = 'doctor';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly auth: DoctorAuthService,
    private readonly doctor: DoctorService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: false, // POC runs on http://localhost
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('auth')
  async login(
    @Body() dto: DoctorAuthDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!this.auth.passcodeMatches(dto.passcode)) {
      await this.audit.record({ actor: ACTOR, action: 'login_failed', ip, userAgent });
      throw new UnauthorizedException('Incorrect passcode.');
    }
    res.cookie(DOCTOR_COOKIE, this.auth.issueToken(), this.cookieOptions());
    await this.audit.record({ actor: ACTOR, action: 'login', ip, userAgent });
    return { authenticated: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(DOCTOR_COOKIE, { path: '/' });
    return { authenticated: false };
  }

  @UseGuards(DoctorAuthGuard)
  @Get('me')
  me() {
    return { authenticated: true };
  }

  @UseGuards(DoctorAuthGuard)
  @Get('assessments')
  async list(
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    const rows = await this.doctor.list({ category, q });
    // Viewing the dashboard exposes every patient's name and mobile.
    await this.audit.record({
      actor: ACTOR,
      action: 'view_dashboard',
      ip,
      userAgent,
    });
    return rows;
  }

  @UseGuards(DoctorAuthGuard)
  @Get('assessments/:id')
  async detail(
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const detail = await this.doctor.detail(id);
    await this.audit.record({
      actor: ACTOR,
      action: 'view_patient',
      entity: 'assessment',
      entityId: id,
      ip,
      userAgent,
    });
    return detail;
  }

  @UseGuards(DoctorAuthGuard)
  @Get('questionnaire/:versionId')
  questionnaire(@Param('versionId') versionId: string) {
    // Static schema labels, not patient data — no audit entry.
    return this.doctor.questionnaireLabels(versionId);
  }

  @UseGuards(DoctorAuthGuard)
  @Post('assessments/:id/review')
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const review = await this.doctor.saveReview(id, dto);
    await this.audit.record({
      actor: ACTOR,
      action: `review:${dto.decision}`,
      entity: 'assessment',
      entityId: id,
      ip,
      userAgent,
    });
    return review;
  }
}
