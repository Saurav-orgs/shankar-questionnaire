import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { createCliSequelize } from './sequelize-instance';

export interface MigrationContext {
  sequelize: Sequelize;
  query: (sql: string) => Promise<unknown>;
}

export function buildMigrator(sequelize: Sequelize) {
  const context: MigrationContext = {
    sequelize,
    query: (sql: string) => sequelize.query(sql),
  };

  return new Umzug({
    migrations: {
      glob: ['migrations/*.ts', { cwd: __dirname }],
    },
    context,
    storage: new SequelizeStorage({ sequelize, tableName: 'migrations' }),
    logger: console,
  });
}

export type Migrator = ReturnType<typeof buildMigrator>;

async function main() {
  const command = process.argv[2] ?? 'up';
  const sequelize = createCliSequelize();
  const migrator = buildMigrator(sequelize);

  try {
    switch (command) {
      case 'up':
        await migrator.up();
        break;
      case 'down':
        await migrator.down();
        break;
      case 'pending': {
        const pending = await migrator.pending();
        console.log(
          pending.length
            ? pending.map((m) => m.name).join('\n')
            : 'No pending migrations.',
        );
        break;
      }
      case 'executed': {
        const executed = await migrator.executed();
        console.log(
          executed.length
            ? executed.map((m) => m.name).join('\n')
            : 'No migrations have run.',
        );
        break;
      }
      default:
        console.error(`Unknown command "${command}".`);
        console.error('Usage: migrate [up|down|pending|executed]');
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main();
}
