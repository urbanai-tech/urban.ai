import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

const baseOptions: Partial<DataSourceOptions> = {
  type: 'mysql',
  entities: [__dirname + '/**/*.entity{.ts,.js}', __dirname + '/entities/*{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
};

export const AppDataSource = new DataSource(
  (process.env.DATABASE_URL
    ? {
        ...baseOptions,
        url: process.env.DATABASE_URL,
      }
    : {
        ...baseOptions,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_urban',
      }) as DataSourceOptions,
);
