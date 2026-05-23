import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserCommunicationPreferences } from '../entities/user-communication-preferences.entity';
import { CommunicationPreferencesController } from './communication-preferences.controller';
import { CommunicationPreferencesService } from './communication-preferences.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserCommunicationPreferences])],
  controllers: [CommunicationPreferencesController],
  providers: [CommunicationPreferencesService],
  exports: [CommunicationPreferencesService],
})
export class CommunicationPreferencesModule {}
