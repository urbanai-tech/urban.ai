import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Like, Repository, type FindOptionsWhere } from 'typeorm';
import {
  EventReference,
  type EventReferenceSize,
  type EventReferenceStatus,
} from '../entities/event-reference.entity';
import { EventReferenceVote } from '../entities/event-reference-vote.entity';
import { EventIdentityService } from '../evento/event-identity.service';
import { EventsCsvImportService } from '../evento/events-csv-import.service';
import { loadReferenceVenues, type ReferenceVenueConfig } from './event-reference.config';
import {
  cleanText,
  normalizeCategory,
  normalizeSize,
  parseReferenceDate,
  referenceFingerprint,
} from './event-reference-normalize';

export const REFERENCE_STATUSES: EventReferenceStatus[] = ['candidato', 'aprovado', 'rejeitado', 'conflito'];

export interface ReferenceListQuery {
  status?: string;
  venueKey?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CsvImportSummary {
  parsedRows: number;
  created: number;
  updated: number;
  unchanged: number;
  invalidRows: Array<{ line: number; reason: string }>;
}

const MAX_CSV_ROWS = 2000;
const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Colunas aceitas no CSV (cabeçalho na 1ª linha; aliases em pt/en). */
const HEADER_ALIASES: Record<string, string> = {
  nome: 'nome',
  name: 'nome',
  evento: 'nome',
  venue: 'venue',
  local: 'venue',
  datainicio: 'data',
  data: 'data',
  date: 'data',
  cidade: 'cidade',
  city: 'cidade',
  categoria: 'categoria',
  category: 'categoria',
  porte: 'porte',
  size: 'porte',
  url: 'url',
  fonte: 'url',
  evidencia: 'url',
};

export const REFERENCE_CSV_TEMPLATE = `nome,venue,dataInicio,cidade,categoria,porte,url
"Palmeiras x Corinthians","Allianz Parque","2026-11-14 18:30","São Paulo","esporte","grande","https://www.allianzparque.com.br/"
"Festival de exemplo","Audio","15/11/2026 22:00","São Paulo","show","medio",""`;

@Injectable()
export class EventReferenceService {
  constructor(
    @InjectRepository(EventReference) private readonly refRepo: Repository<EventReference>,
    @InjectRepository(EventReferenceVote) private readonly voteRepo: Repository<EventReferenceVote>,
    private readonly identity: EventIdentityService,
    private readonly csv: EventsCsvImportService,
  ) {}

  async list(query: ReferenceListQuery) {
    const page = Math.max(1, Math.floor(Number(query.page)) || 1);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit)) || 25));
    const where: FindOptionsWhere<EventReference> = {};
    if (query.status) {
      if (!REFERENCE_STATUSES.includes(query.status as EventReferenceStatus)) {
        throw new BadRequestException('status inválido');
      }
      where.status = query.status as EventReferenceStatus;
    }
    if (query.venueKey) where.venueKey = String(query.venueKey).slice(0, 64);
    if (query.q?.trim()) where.name = Like(`%${query.q.trim().slice(0, 80).replace(/[%_]/g, '')}%`);
    if (query.from || query.to) {
      where.dateKey = Between(query.from ?? '0000-01-01', query.to ?? '9999-12-31');
    }
    const [items, total] = await this.refRepo.findAndCount({
      where,
      order: { dateKey: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map((r) => this.toListItem(r)), total, page, limit };
  }

  /** Fila de conflitos com os votos de cada referência (a revisão humana decide aqui). */
  async conflictQueue(limit = 50) {
    const refs = await this.refRepo.find({
      where: { status: 'conflito' },
      order: { dateKey: 'ASC' },
      take: Math.max(1, Math.min(100, limit)),
    });
    const out = [];
    for (const ref of refs) {
      const votes = await this.voteRepo.find({ where: { referenceId: ref.id }, order: { createdAt: 'ASC' } });
      out.push({ ...this.toListItem(ref), votes: votes.map((v) => this.toVote(v)) });
    }
    return out;
  }

  async get(id: string) {
    const ref = await this.refRepo.findOne({ where: { id } });
    if (!ref) throw new NotFoundException('Referência não encontrada');
    const votes = await this.voteRepo.find({ where: { referenceId: id }, order: { createdAt: 'ASC' } });
    return { ...this.toListItem(ref), votes: votes.map((v) => this.toVote(v)) };
  }

  async approve(id: string, actorUserId: string | null, note?: string) {
    return this.decide(id, 'aprovado', actorUserId, note);
  }

  async reject(id: string, actorUserId: string | null, note?: string) {
    return this.decide(id, 'rejeitado', actorUserId, note);
  }

  private async decide(id: string, status: 'aprovado' | 'rejeitado', actorUserId: string | null, note?: string) {
    const ref = await this.refRepo.findOne({ where: { id } });
    if (!ref) throw new NotFoundException('Referência não encontrada');
    const before = this.toListItem(ref);
    ref.status = status;
    ref.approvedBy = actorUserId ?? 'admin';
    ref.approvedAt = new Date();
    ref.decisionNote = note ? cleanText(note, 500) : null;
    ref.conflictReason = null;
    await this.refRepo.save(ref);
    return { before, after: this.toListItem(ref) };
  }

  // ---------------------------------------------------------------------------
  // Import CSV (curadoria humana)
  // ---------------------------------------------------------------------------

  async importCsv(
    buffer: Buffer,
    actorUserId: string | null,
    options: { status?: 'aprovado' | 'candidato' } = {},
  ): Promise<CsvImportSummary> {
    if (!buffer || buffer.length === 0) throw new BadRequestException('arquivo CSV vazio');
    if (buffer.length > MAX_CSV_BYTES) throw new BadRequestException('arquivo > 2MB');
    const decoded = buffer.toString('utf8');
    const text = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
    const rows = this.csv.parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
    if (rows.length < 2) throw new BadRequestException('CSV sem linhas de dados');
    if (rows.length - 1 > MAX_CSV_ROWS) throw new BadRequestException(`CSV com mais de ${MAX_CSV_ROWS} linhas`);

    const header = rows[0].map((h) => {
      const key = h
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z]/g, '');
      return HEADER_ALIASES[key] ?? null;
    });
    for (const required of ['nome', 'venue', 'data']) {
      if (!header.includes(required)) throw new BadRequestException(`coluna obrigatória ausente: ${required}`);
    }

    const { venues } = loadReferenceVenues();
    const status = options.status === 'candidato' ? 'candidato' : 'aprovado';
    const summary: CsvImportSummary = { parsedRows: rows.length - 1, created: 0, updated: 0, unchanged: 0, invalidRows: [] };

    for (let i = 1; i < rows.length; i += 1) {
      const line = i + 1;
      const cell = (name: string) => {
        const idx = header.indexOf(name);
        return idx >= 0 ? (rows[i][idx] ?? '').trim() : '';
      };
      const name = cleanText(cell('nome'), 255);
      const venueText = cleanText(cell('venue'), 160);
      const date = parseReferenceDate(cell('data'));
      if (name.length < 3) {
        summary.invalidRows.push({ line, reason: 'nome ausente ou curto demais' });
        continue;
      }
      if (!venueText) {
        summary.invalidRows.push({ line, reason: 'venue ausente' });
        continue;
      }
      if (!date) {
        summary.invalidRows.push({ line, reason: 'data inválida (use AAAA-MM-DD, ISO ou dd/mm/aaaa)' });
        continue;
      }
      const url = cell('url');
      if (url && !/^https?:\/\//i.test(url)) {
        summary.invalidRows.push({ line, reason: 'url de evidência precisa começar com http(s)' });
        continue;
      }

      const venue = this.resolveVenue(venues, venueText);
      const size: EventReferenceSize = normalizeSize(cell('porte')) ?? venue?.size ?? 'medio';
      const fingerprint = referenceFingerprint(this.identity, { name, dateKey: date.dateKey, venue: venue?.name ?? venueText });
      const existing = await this.refRepo.findOne({ where: { fingerprint } });

      if (!existing) {
        await this.refRepo.save(
          this.refRepo.create({
            name,
            normalizedName: this.identity.normalizeText(name).slice(0, 255),
            venueKey: venue?.key ?? null,
            venueName: venue?.name ?? venueText,
            normalizedVenue: this.identity.normalizeVenue(venue?.name ?? venueText).slice(0, 255),
            startsAt: date.instant,
            dateKey: date.dateKey,
            city: cleanText(cell('cidade'), 80) || venue?.city || 'São Paulo',
            category: normalizeCategory(cell('categoria')) ?? venue?.category ?? null,
            size,
            status,
            origin: 'csv',
            fingerprint,
            evidenceUrls: url ? [url] : [],
            votesSupport: 0,
            votesAgainst: 0,
            approvedBy: status === 'aprovado' ? (actorUserId ?? 'admin') : null,
            approvedAt: status === 'aprovado' ? new Date() : null,
            decisionNote: 'importado por CSV',
          }),
        );
        summary.created += 1;
        continue;
      }

      const urls = new Set(existing.evidenceUrls ?? []);
      if (url) urls.add(url);
      const needsApproval = status === 'aprovado' && existing.status !== 'aprovado';
      const addsEvidence = urls.size !== (existing.evidenceUrls ?? []).length;
      if (!needsApproval && !addsEvidence) {
        summary.unchanged += 1;
        continue;
      }
      existing.evidenceUrls = [...urls].slice(0, 10);
      if (needsApproval) {
        existing.status = 'aprovado';
        existing.approvedBy = actorUserId ?? 'admin';
        existing.approvedAt = new Date();
        existing.conflictReason = null;
        existing.decisionNote = 'aprovado por importação de CSV';
      }
      await this.refRepo.save(existing);
      summary.updated += 1;
    }
    return summary;
  }

  private resolveVenue(venues: ReferenceVenueConfig[], text: string): ReferenceVenueConfig | null {
    const normalized = this.identity.normalizeVenue(text);
    if (!normalized) return null;
    for (const venue of venues) {
      const names = [venue.name, ...venue.aliases].map((n) => this.identity.normalizeVenue(n)).filter((n) => n.length >= 3);
      if (names.some((n) => normalized === n || normalized.includes(n))) return venue;
    }
    return null;
  }

  // ---------------------------------------------------------------------------

  private toListItem(ref: EventReference) {
    return {
      id: ref.id,
      name: ref.name,
      venueKey: ref.venueKey,
      venueName: ref.venueName,
      startsAt: ref.startsAt instanceof Date ? ref.startsAt.toISOString() : ref.startsAt,
      dateKey: ref.dateKey,
      city: ref.city,
      category: ref.category,
      size: ref.size,
      status: ref.status,
      origin: ref.origin,
      evidenceUrls: ref.evidenceUrls ?? [],
      votesSupport: ref.votesSupport,
      votesAgainst: ref.votesAgainst,
      approvedBy: ref.approvedBy,
      approvedAt: ref.approvedAt instanceof Date ? ref.approvedAt.toISOString() : ref.approvedAt,
      decisionNote: ref.decisionNote,
      conflictReason: ref.conflictReason,
      matchedEventId: ref.matchedEventId,
      matchedAt: ref.matchedAt instanceof Date ? ref.matchedAt.toISOString() : ref.matchedAt,
    };
  }

  private toVote(vote: EventReferenceVote) {
    return {
      id: vote.id,
      validatorKey: vote.validatorKey,
      validatorKind: vote.validatorKind,
      verdict: vote.verdict,
      sourceUrl: vote.sourceUrl,
      extractor: vote.extractor,
      observedName: vote.observedName,
      observedDate: vote.observedDate,
      observedVenue: vote.observedVenue,
      snippet: vote.snippet,
      createdAt: vote.createdAt instanceof Date ? vote.createdAt.toISOString() : vote.createdAt,
    };
  }
}
