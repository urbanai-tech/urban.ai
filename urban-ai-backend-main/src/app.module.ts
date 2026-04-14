
import { MailerModule } from './mailer/mailer.module';
import { CronModule } from './cron/cron.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AirbnbModule } from './airbnb/airbnb.module';
import { ProcessoModule } from './processos/processo.module';
import { ProcessoController } from './processos/processo.controller';
import { PropriedadeModule } from './propriedades/propriedade.module';
import { EventoModule } from './evento/evento.module';
import { EmailModule } from './email/email.module';
import { ProcessModule } from './process/process.module';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { UserModule } from './user/user.module';
import { ConnectModule } from './connect/connect.module';
import { AuthModule } from './auth/auth.module';
import { MapsModule } from './maps/maps.module';
import { SugestionModule } from './sugestao/sugestion.module'
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { PlansModule } from './plans/plans.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    MailerModule,
    CronModule,
    DashboardModule,
    AirbnbModule,
    NotificationsModule,
    SugestionModule,
    ProcessoModule,
    HttpModule.register({
      baseURL: 'http://localhost:3000',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),
    BullModule.registerQueue({
      name: 'processos',
    }),
    PropriedadeModule,
    EventoModule,
    EmailModule,
    ProcessModule,
    PaymentsModule,
    PlansModule,
    // 1) Load .env first, globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 1.1) Registrar o ScheduleModule
    ScheduleModule.forRoot({}),

    // 2) Database connection — MySQL
    // Suporta DATABASE_URL (Railway) ou variáveis individuais
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'mysql',
            connectorPackage: 'mysql2',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            synchronize: true,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
          }
        : {
            type: 'mysql',
            connectorPackage: 'mysql2',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            username: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'ai_urban',
            autoLoadEntities: true,
            synchronize: true,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
          },
    ),

    // 3) Módulos de domínio
    UserModule,
    ConnectModule,
    AuthModule,
    MapsModule,

    // 4) Static file serving
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [
    ProcessoController, AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    AppService,
  ],
})
export class AppModule { }
