import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { buildMigrator } from './migrator';
import { runSeed } from './seed';

/**
 * Brings any database — fresh or existing — up to the state the API needs
 * before it serves a request: schema migrated, one doctor (Dr. Shankar
 * Acharya) present, current questionnaire version published.
 *
 * Everything it does is idempotent (umzug skips executed migrations, the seed
 * upserts), so it is safe to run on every start. Set DB_AUTO_SETUP=false to
 * opt out and run `npm run db:setup` by hand instead — e.g. in a deployment
 * where the app's database role is not allowed to alter the schema.
 */
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('DB_AUTO_SETUP') === 'false') {
      this.logger.log('DB_AUTO_SETUP=false — skipping migrations and seed.');
      return;
    }
    await this.setup();
  }

  async setup(): Promise<void> {
    const migrator = buildMigrator(this.sequelize);
    const migrated = await migrator.up();
    this.logger.log(
      migrated.length
        ? `Ran ${migrated.length} migration(s): ${migrated.map((m) => m.name).join(', ')}`
        : 'Schema up to date.',
    );

    const seed = await runSeed(this.sequelize, {
      log: (message) => this.logger.log(message),
    });
    this.logger.log(
      `Database ready — doctor ${seed.doctorId}, questionnaire v${seed.questionnaireVersion}.`,
    );
  }
}
