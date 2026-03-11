import { SugestionService } from './sugestion.service';
import { SugestionController } from './sugestion.controller';

import { Module } from '@nestjs/common';
import { User } from 'src/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from 'src/entities/events.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Address } from 'src/entities/addresses.entity';

@Module({
  imports:[TypeOrmModule.forFeature([
          User,
          Event,
          AnalisePreco,
          Address
      ]),],
    controllers: [
        SugestionController,],
    providers: [
        SugestionService,],
})
export class SugestionModule { }
