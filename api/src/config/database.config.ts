import { ConfigService } from '@nestjs/config';
import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { models } from '../models';

export function buildDatabaseOptions(
  config: ConfigService,
): SequelizeModuleOptions {
  const useSsl = config.get<string>('DATABASE_SSL') === 'true';

  return {
    dialect: 'postgres',
    host: config.get<string>('DATABASE_HOST'),
    port: Number(config.get<string>('DATABASE_PORT')),
    username: config.get<string>('DATABASE_USER'),
    password: config.get<string>('DATABASE_PASSWORD'),
    database: config.get<string>('DATABASE_NAME'),
    logging:
      config.get<string>('DATABASE_LOGGING') === 'true' ? console.log : false,
    dialectOptions: useSsl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    // Schema is owned by migrations. Never sync in place.
    synchronize: false,
    models,
  };
}
