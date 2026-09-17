import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { buildDatabaseOptions } from './config/database.config';
import { DoctorModule } from './doctor/doctor.module';
import { HealthModule } from './health/health.module';
import { PatientModule } from './patient.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildDatabaseOptions,
    }),
    // A patient answering ~50 questions autosaves after each one, and a whole
    // clinic waiting room shares a single IP. 120/min throttled real usage.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    HealthModule,
    PatientModule,
    DoctorModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
