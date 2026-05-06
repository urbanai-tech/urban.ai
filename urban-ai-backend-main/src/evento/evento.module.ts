import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { EventsEnrichmentService } from './events-enrichment.service';
import { EventsIngestService } from './events-ingest.service';
import { EventsIngestController } from './events-ingest.controller';
import { EventsGeocoderService } from './events-geocoder.service';
import { EventsCsvImportService } from './events-csv-import.service';
import { CoverageService } from './coverage.service';
import { CoverageController } from './coverage.controller';
import { CoverageSeederService } from './coverage-seeder.service';
import { Module, OnModuleInit } from '@nestjs/common';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { List } from 'src/entities/list.entity';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';
import { User } from 'src/entities/user.entity';
import { CoverageRegion } from 'src/entities/coverage-region.entity';
import { AuthModule } from 'src/auth/auth.module';
import { MapsModule } from 'src/maps/maps.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnaliseEnderecoEvento,
      Address,
      Event,
      List,
      User,
      CoverageRegion,
    ]),
    AuthModule,
    MapsModule,
  ],
  controllers: [EventoController, EventsIngestController, CoverageController],
  providers: [
    EventoService,
    EventsEnrichmentService,
    EventsIngestService,
    EventsGeocoderService,
    EventsCsvImportService,
    CoverageService,
    CoverageSeederService,
  ],
  exports: [
    EventsIngestService,
    EventsGeocoderService,
    EventsCsvImportService,
    CoverageService,
  ],
})
export class EventoModule implements OnModuleInit {
  constructor(private readonly seeder: CoverageSeederService) {}

  async onModuleInit() {
    // Garante que existe ao menos a região "Grande São Paulo" no boot.
    // Idempotente: só cria se não existe nenhuma região ainda.
    await this.seeder.seedDefaultIfEmpty();
  }
}
