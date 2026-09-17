import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  database: {
    connected: boolean;
    name?: string;
    serverVersion?: string;
    latencyMs?: number;
    error?: string;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async check(): Promise<HealthReport> {
    const startedAt = Date.now();

    try {
      const [row] = await this.sequelize.query<{
        db: string;
        version: string;
      }>('SELECT current_database() AS db, version() AS version', {
        type: 'SELECT' as never,
      });

      return {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          name: row?.db,
          serverVersion: row?.version?.split(' ').slice(0, 2).join(' '),
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(`Health check failed: ${message}`);

      return {
        status: 'degraded',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        database: { connected: false, error: message },
      };
    }
  }
}
