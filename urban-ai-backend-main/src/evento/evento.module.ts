import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { EventsEnrichmentService } from './events-enrichment.service';
import { EventsIngestService } from './events-ingest.service';
import { EventsIngestController } from './events-ingest.controller';
import { EventsGeocoderService } from './events-geocoder.service';
import { EventsCsvImportService } from './events-csv-import.service';
import { Module } from '@nestjs/common';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { List } from 'src/entities/list.entity';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';
import { User } from 'src/entities/user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { MapsModule } from 'src/maps/maps.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnaliseEnderecoEvento, Address, Event, List, User]),
    AuthModule,
    MapsModule,
  ],
  controllers: [EventoController, EventsIngestController],
  providers: [
    EventoService,
    EventsEnrichmentService,
    EventsIngestService,
    EventsGeocoderService,
    EventsCsvImportService,
  ],
  exports: [EventsIngestService, EventsGeocoderService, EventsCsvImportService],
})
export class EventoModule {}
