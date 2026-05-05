import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Waitlist } from '../entities/waitlist.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { MailerModule } from '../mailer/mailer.module';
import { AuthModule } from '../auth/auth.module';

/**
 * F8.2 — pré-lançamento (waitlist).
 *
 * Importa MailerModule para enviar e-mail de convite.
 * forwardRef(AuthModule) porque AuthController também injeta WaitlistService
 * (gating em /auth/register quando PRELAUNCH_MODE=true) — evita circular
 * dependency em tempo de boot do Nest.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Waitlist]),
    MailerModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
