import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { Module } from '@nestjs/common';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { List } from 'src/entities/list.entity';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';

@Module({
    imports: [    TypeOrmModule.forFeature([
          AnaliseEnderecoEvento,
          Address,
          Event,
          List
        ]),],
    controllers: [
        EventoController,],
    providers: [
        EventoService,],
})
export class EventoModule { }
