import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { EventsEnrichmentService } from './events-enrichment.service';
import { EventsIngestService } from './events-ingest.service';
import { EventsIngestController } from './events-ingest.controller';
import { Module } from '@nestjs/common';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { List } from 'src/entities/list.entity';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnaliseEnderecoEvento, Address, Event, List]),
    AuthModule,
  ],
  controllers: [EventoController, EventsIngestController],
  providers: [EventoService, EventsEnrichmentService, EventsIngestService],
  exports: [EventsIngestService],
})
export class EventoModule {}
