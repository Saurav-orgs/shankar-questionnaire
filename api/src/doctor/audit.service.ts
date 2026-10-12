import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from '../models';

export interface AuditEntry {
  actor: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Records who looked at (or acted on) patient data. This is health data with
 * names and phone numbers attached — "who viewed what, and when" must be
 * answerable (plan.md §10).
 *
 * Logging is best-effort: a failure here is written to the app log but never
 * propagated, so an audit-table problem can never block a doctor from seeing a
 * patient. The audit trail must not become a single point of failure for care.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog) private readonly auditLogs: typeof AuditLog,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogs.create({
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      } as Partial<AuditLog> as AuditLog);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to write audit log (${entry.action}): ${message}`,
      );
    }
  }
}
