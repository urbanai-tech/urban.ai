
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
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';      // ← importe aqui
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

@Module({
  imports: [
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
        host: 'trolley.proxy.rlwy.net',
        port: 22539,
        username: 'default',
        password: 'keSVqRPESvxhtyZXdgnKVZUdyBvYWKfg',
      },
    }),
    BullModule.registerQueue({
      name: 'processos', // nome usado no Processor
    }),
    PropriedadeModule,
    EventoModule,
    EmailModule,
    ProcessModule,
    PaymentsModule,
    // 1) Load .env first, globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 1.1) Registrar o ScheduleModule antes dos seus serviços agendados
    ScheduleModule.forRoot({
      // define seu timezone padrão, opcional
    }),

    // 2) Database connection
    TypeOrmModule.forRoot({
      type: 'mysql',
      driver: require('mysql2'),
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_urban',
      autoLoadEntities: true,
      synchronize: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
    }),

    // 3) Seus módulos de domínio
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
  providers: [AppService],
})
export class AppModule { }
