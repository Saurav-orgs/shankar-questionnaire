import 'dotenv/config';
import { Sequelize } from 'sequelize';

/**
 * A plain Sequelize instance for CLI tooling (migrations, seeds).
 * The running application uses Nest's SequelizeModule instead — this exists so
 * migrations can run without booting the whole Nest app.
 */
export function createCliSequelize(): Sequelize {
  return new Sequelize({
    dialect: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    logging: process.env.DATABASE_LOGGING === 'true' ? console.log : false,
    dialectOptions:
      process.env.DATABASE_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  });
}
