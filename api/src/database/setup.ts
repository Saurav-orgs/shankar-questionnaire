import { buildMigrator } from './migrator';
import { runSeed } from './seed';
import { createCliSequelize } from './sequelize-instance';

/**
 * `npm run db:setup` — migrate + seed in one go, without booting the API.
 * The API does the same thing on start (DatabaseBootstrapService); this is
 * for CI, deploy hooks, or when DB_AUTO_SETUP=false.
 */
async function main(): Promise<void> {
  const sequelize = createCliSequelize();
  try {
    const migrated = await buildMigrator(sequelize).up();
    console.log(
      migrated.length
        ? `Ran ${migrated.length} migration(s).`
        : 'Schema up to date.',
    );
    await runSeed(sequelize);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

void main();
