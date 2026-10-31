import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { EventsEnrichmentService } from './events-enrichment.service';
import { EventsIngestService } from './events-ingest.service';
import { EventsIngestController } from './events-ingest.controller';
import { EventsIngestApiKeyGuard } from './events-ingest-api-key.guard';
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
import { EventDedupCandidate } from 'src/entities/event-dedup-candidate.entity';
import { EventSource } from 'src/entities/event-source.entity';
import { User } from 'src/entities/user.entity';
import { CoverageRegion } from 'src/entities/coverage-region.entity';
import { AdminJobRun } from 'src/entities/admin-job-run.entity';
import { AuthModule } from 'src/auth/auth.module';
import { MapsModule } from 'src/maps/maps.module';
import { AdminAuditModule } from 'src/admin-audit/admin-audit.module';
import { EventIdentityService } from './event-identity.service';
import { CollectorStalenessService } from './collector-staleness.service';
import { CollectorZeroYieldService } from './collector-zero-yield.service';
import { EventCoverageReportService } from './event-coverage-report.service';
import { EventCoverageReportController } from './event-coverage-report.controller';
import { EventChangeHistory } from 'src/entities/event-change-history.entity';
import { CollectorAlertState } from 'src/entities/collector-alert-state.entity';
import { EventChangeHistoryService } from './event-change-history.service';
import { EventChangesController } from './event-changes.controller';
import { CollectorAlertStateService } from './collector-alert-state.service';
import { MailerModule } from 'src/mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnaliseEnderecoEvento,
      Address,
      Event,
      EventDedupCandidate,
      EventSource,
      List,
      User,
      CoverageRegion,
      AdminJobRun,
      EventChangeHistory,
      CollectorAlertState,
    ]),
    AuthModule,
    MapsModule,
    AdminAuditModule,
    MailerModule,
  ],
  controllers: [
    EventoController,
    EventsIngestController,
    CoverageController,
    EventCoverageReportController,
    EventChangesController,
  ],
  providers: [
    EventoService,
    EventsEnrichmentService,
    EventsIngestService,
    EventIdentityService,
    EventsIngestApiKeyGuard,
    EventsGeocoderService,
    EventsCsvImportService,
    CoverageService,
    CoverageSeederService,
    CollectorStalenessService,
    CollectorZeroYieldService,
    EventCoverageReportService,
    EventChangeHistoryService,
    CollectorAlertStateService,
  ],
  exports: [
    EventsIngestService,
    EventIdentityService,
    EventsEnrichmentService,
    EventsGeocoderService,
    EventsCsvImportService,
    CoverageService,
    CollectorZeroYieldService,
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
