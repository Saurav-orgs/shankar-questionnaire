import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Cross-origin policy.
 *
 * Default: every origin is allowed. The request's own `Origin` is reflected
 * rather than answered with `*`, because the doctor session is a cookie and
 * browsers reject `Access-Control-Allow-Origin: *` on a credentialed request —
 * a literal `*` would block the doctor panel rather than open it up.
 *
 * Set `CORS_ORIGINS` to a comma-separated list to restrict it again, e.g.
 *   CORS_ORIGINS=https://patient.example.com,https://doctor.example.com
 */
function corsOrigin(config: ConfigService, logger: Logger): true | string[] {
  const configured = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (configured.length) {
    logger.log(`CORS restricted to: ${configured.join(', ')}`);
    return configured;
  }

  logger.warn(
    'CORS is open to all origins (CORS_ORIGINS is unset). Any site can call this API with the doctor session cookie — set CORS_ORIGINS before handling real patient data.',
  );
  return true;
}

/**
 * Fails the boot on a cookie configuration the browser would silently reject,
 * which otherwise shows up as "login works, every later request is a 401".
 */
function validateCookieConfig(config: ConfigService): void {
  const sameSite = config.get<string>('COOKIE_SAMESITE');
  const secure = config.get<string>('COOKIE_SECURE') === 'true';

  if (sameSite === 'none' && !secure) {
    throw new Error(
      'COOKIE_SAMESITE=none requires COOKIE_SECURE=true — browsers drop a SameSite=None cookie that is not Secure, so the doctor panel could log in but never stay logged in.',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  validateCookieConfig(config);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigin(config, logger),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Behind a proxy or load balancer the client IP arrives in
  // X-Forwarded-For. Without this, `@Ip()` records the balancer for every
  // request, so audit logs (plan.md §10) all share one IP and the login
  // throttle buckets every visitor together.
  if (config.get<string>('TRUST_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    logger.log('Trusting X-Forwarded-For (TRUST_PROXY=true)');
  }

  const port = Number(config.get<string>('PORT')) || 4000;
  await app.listen(port);

  logger.log(`API listening on port ${port}, routes under /api`);
}

void bootstrap();
