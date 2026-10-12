import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export const DOCTOR_COOKIE = 'doctor_session';

/**
 * Minimal passcode auth for the POC — plan.md §15 is explicit that this is not
 * adequate for real patient data. A correct passcode mints an HMAC-signed
 * cookie; the guard verifies the signature. No user table, no sessions store.
 */
@Injectable()
export class DoctorAuthService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('SESSION_SECRET') ?? 'dev-secret';
  }

  passcodeMatches(passcode: string): boolean {
    const expected = this.config.get<string>('DOCTOR_PANEL_PASSCODE') ?? '';
    if (!expected) return false;
    const a = Buffer.from(passcode);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** token = <issuedAtMs>.<hmac(issuedAtMs)>. */
  issueToken(): string {
    const issued = String(Date.now());
    const sig = createHmac('sha256', this.secret())
      .update(issued)
      .digest('hex');
    return `${issued}.${sig}`;
  }

  verifyToken(token: string | undefined): boolean {
    if (!token) return false;
    const [issued, sig] = token.split('.');
    if (!issued || !sig) return false;
    const expected = createHmac('sha256', this.secret())
      .update(issued)
      .digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

@Injectable()
export class DoctorAuthGuard implements CanActivate {
  constructor(private readonly auth: DoctorAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const token = cookies?.[DOCTOR_COOKIE];
    if (!this.auth.verifyToken(token)) {
      throw new UnauthorizedException('Not signed in.');
    }
    return true;
  }
}
