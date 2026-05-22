import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

const runtimeEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const isLocalRuntime = ['development', 'dev', 'test', 'local'].includes(runtimeEnv);

function envOrLocalDefault(name: string, localDefault: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isLocalRuntime) return localDefault;
  throw new Error(`${name} is required outside local development`);
}

const baseOptions: Partial<DataSourceOptions> = {
  type: 'mysql',
  entities: [__dirname + '/**/*.entity{.ts,.js}', __dirname + '/entities/*{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  migrationsRun: false,
};

export const AppDataSource = new DataSource(
  (process.env.DATABASE_URL
    ? {
        ...baseOptions,
        url: process.env.DATABASE_URL,
      }
    : {
        ...baseOptions,
        host: envOrLocalDefault('DB_HOST', 'localhost'),
        port: parseInt(process.env.DB_PORT || '3306', 10),
        username: envOrLocalDefault('DB_USER', 'root'),
        password: isLocalRuntime ? (process.env.DB_PASSWORD ?? '') : envOrLocalDefault('DB_PASSWORD', ''),
        database: envOrLocalDefault('DB_NAME', 'ai_urban'),
      }) as DataSourceOptions,
);
