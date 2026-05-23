import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

export type EventsCollectorRequestContext = {
  actor: string;
  collectorVersion: string | null;
  ingestRunId: string | null;
};

@Injectable()
export class EventsIngestApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const configuredKey = this.configuredKey();

    if (!configuredKey) {
      throw new ServiceUnavailableException('events ingest api key not configured');
    }

    const providedKey = this.header(req, 'x-urban-events-ingest-key') ?? this.header(req, 'x-api-key');
    if (!providedKey || !this.safeEqual(configuredKey, providedKey)) {
      throw new UnauthorizedException('invalid events ingest api key');
    }

    const actor = this.header(req, 'x-urban-collector') || 'events-collector';
    req.collector = {
      actor: actor.slice(0, 96),
      collectorVersion: this.header(req, 'x-urban-collector-version')?.slice(0, 64) ?? null,
      ingestRunId: this.header(req, 'x-urban-ingest-run-id')?.slice(0, 128) ?? null,
    } satisfies EventsCollectorRequestContext;
    return true;
  }

  private configuredKey(): string {
    return String(process.env.EVENTS_INGEST_API_KEY ?? '').trim();
  }

  private header(req: any, name: string): string | null {
    const raw = req?.headers?.[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const text = String(value ?? '').trim();
    return text.length ? text : null;
  }

  private safeEqual(expected: string, actual: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
