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
import {
  DOCTOR_COOKIE,
  DoctorAuthGuard,
  DoctorAuthService,
} from './doctor-auth';
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

  /**
   * Cookie attributes for the doctor session.
   *
   * These have to change between localhost and a deployed environment, so they
   * are read from config rather than hardcoded:
   *
   *   COOKIE_SECURE    — true over HTTPS. A `Secure` cookie is dropped on plain
   *                      http, so this must stay false for local development.
   *   COOKIE_SAMESITE  — 'lax' when the doctor app and the API share an origin.
   *                      'none' when they are on different domains, because the
   *                      browser will otherwise accept the cookie and then
   *                      refuse to send it on XHR — login appears to succeed and
   *                      every later request 401s. 'none' additionally *requires*
   *                      Secure, which `validateCookieConfig` enforces at boot.
   *
   * Defaults are the local-development values, so an unset environment behaves
   * exactly as the POC did.
   */
  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite:
        this.config.get<string>('COOKIE_SAMESITE') === 'none'
          ? ('none' as const)
          : this.config.get<string>('COOKIE_SAMESITE') === 'strict'
            ? ('strict' as const)
            : ('lax' as const),
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    };
  }

  /**
   * Attributes used to clear the cookie. A cookie is only removed when the
   * clearing response matches the attributes it was set with, so logout has to
   * reuse them — otherwise a cross-site session survives "Sign out".
   */
  private clearCookieOptions() {
    const { httpOnly, sameSite, secure, path } = this.cookieOptions();
    return { httpOnly, sameSite, secure, path };
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
      await this.audit.record({
        actor: ACTOR,
        action: 'login_failed',
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Incorrect passcode.');
    }
    res.cookie(DOCTOR_COOKIE, this.auth.issueToken(), this.cookieOptions());
    await this.audit.record({ actor: ACTOR, action: 'login', ip, userAgent });
    return { authenticated: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(DOCTOR_COOKIE, this.clearCookieOptions());
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
