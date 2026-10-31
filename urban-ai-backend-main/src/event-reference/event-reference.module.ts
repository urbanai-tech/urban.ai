import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { MailerModule } from '../mailer/mailer.module';
import { EventoModule } from '../evento/evento.module';
import { Event } from '../entities/events.entity';
import { EventSource } from '../entities/event-source.entity';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { EventReference } from '../entities/event-reference.entity';
import { EventReferenceVote } from '../entities/event-reference-vote.entity';
import { EventCoverageSnapshot } from '../entities/event-coverage-snapshot.entity';
import { EventReferenceFetchCache } from '../entities/event-reference-fetch-cache.entity';
import { EventReferenceController } from './event-reference.controller';
import { EventCoveragePublicController } from './event-coverage-public.controller';
import { EventReferenceService } from './event-reference.service';
import { EventReferenceCurationService } from './event-reference-curation.service';
import { EventReferenceSourcesService } from './event-reference-sources.service';
import { EventReferenceLlmService } from './event-reference-llm.service';
import { EventCoverageService } from './event-coverage.service';
import { EventCoveragePublicService } from './event-coverage-public.service';

/** ADR 0026 — cobertura de eventos auditada: lista de referência, curadoria, recall e precisão. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventReference,
      EventReferenceVote,
      EventCoverageSnapshot,
      EventReferenceFetchCache,
      Event,
      EventSource,
      AdminJobRun,
    ]),
    AuthModule,
    AdminAuditModule,
    MailerModule,
    EventoModule,
  ],
  controllers: [EventReferenceController, EventCoveragePublicController],
  providers: [
    EventReferenceService,
    EventReferenceCurationService,
    EventReferenceSourcesService,
    EventReferenceLlmService,
    EventCoverageService,
    EventCoveragePublicService,
  ],
  exports: [EventCoverageService],
})
export class EventReferenceModule {}
