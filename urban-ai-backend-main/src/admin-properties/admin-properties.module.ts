import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Event } from '../entities/events.entity';
import { List } from '../entities/list.entity';
import { User } from '../entities/user.entity';
import { MapsModule } from '../maps/maps.module';
import { AdminPropertiesController } from './admin-properties.controller';
import { AdminPropertiesService } from './admin-properties.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Address, AnalisePreco, Event, List, User]),
    MapsModule,
  ],
  controllers: [AdminPropertiesController],
  providers: [AdminPropertiesService],
})
export class AdminPropertiesModule {}
