import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // Exactly two origins: the patient app and the doctor app. Nothing else.
  app.enableCors({
    origin: [
      config.get<string>('PATIENT_WEB_ORIGIN'),
      config.get<string>('DOCTOR_WEB_ORIGIN'),
    ].filter(Boolean) as string[],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT')) || 4000;
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
