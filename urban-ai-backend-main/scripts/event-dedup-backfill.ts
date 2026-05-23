#!/usr/bin/env ts-node

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Brackets } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { Event } from '../src/entities/events.entity';

type CliOptions = {
  help: boolean;
  apply: boolean;
  limit: number;
  lookbackDays: number;
  lookaheadDays: number;
  minScore: number;
  highScore: number;
  geoHighMeters: number;
  geoMediumMeters: number;
  includeInactive: boolean;
  csv?: string;
};

type EventSnapshot = Pick<
  Event,
  | 'id'
  | 'nome'
  | 'dataInicio'
  | 'dataFim'
  | 'enderecoCompleto'
  | 'cidade'
  | 'estado'
  | 'latitude'
  | 'longitude'
  | 'source'
  | 'sourceId'
  | 'dedupHash'
  | 'ativo'
>;

type PairCandidate = {
  left: EventSnapshot;
  right: EventSnapshot;
  score: number;
  confidence: 'high' | 'medium';
  reasons: string[];
  distanceMeters: number | null;
  nameSimilarity: number;
  addressSimilarity: number;
};

type DuplicateGroup = {
  id: number;
  confidence: 'high' | 'medium';
  score: number;
  eventIds: string[];
  pairs: PairCandidate[];
  sources: string[];
};

const DEFAULT_OPTIONS: CliOptions = {
  help: false,
  apply: false,
  limit: 10000,
  lookbackDays: 30,
  lookaheadDays: 365,
  minScore: 0.72,
  highScore: 0.86,
  geoHighMeters: 250,
  geoMediumMeters: 750,
  includeInactive: false,
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (options.apply) {
    throw new Error(
      '--apply ainda nao executa merge. Use o dry-run/CSV para revisao e integre o merge ao servico de identidade aprovado antes de escrever no banco.',
    );
  }

  const startedAt = new Date();
  const { from, to } = buildWindow(options, startedAt);

  await AppDataSource.initialize();
  try {
    const events = await readEvents(from, to, options);
    const candidates = findCandidates(events, options);
    const groups = buildGroups(candidates);
    const report = renderReport({
      generatedAt: startedAt.toISOString(),
      from,
      to,
      options,
      events,
      candidates,
      groups,
    });

    process.stdout.write(report);
    if (options.csv) {
      writeCsv(options.csv, candidates);
      process.stdout.write(`\nCSV written: ${path.resolve(options.csv)}\n`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

async function readEvents(from: Date, to: Date, options: CliOptions): Promise<EventSnapshot[]> {
  const repo = AppDataSource.getRepository(Event);
  const query = repo
    .createQueryBuilder('event')
    .where('event.dataInicio BETWEEN :from AND :to', { from, to })
    .andWhere(
      new Brackets((qb) => {
        qb.where('event.nome IS NOT NULL').andWhere("TRIM(event.nome) <> ''");
      }),
    )
    .orderBy('event.dataInicio', 'ASC')
    .addOrderBy('event.nome', 'ASC')
    .take(options.limit);

  if (!options.includeInactive) {
    query.andWhere('event.ativo = :ativo', { ativo: true });
  }

  return query.getMany() as Promise<EventSnapshot[]>;
}

function findCandidates(events: EventSnapshot[], options: CliOptions): PairCandidate[] {
  const buckets = new Map<string, EventSnapshot[]>();
  for (const event of events) {
    const key = [
      dateKey(event.dataInicio),
      normalizeToken(event.estado || ''),
      normalizeToken(event.cidade || ''),
    ].join('|');
    buckets.set(key, [...(buckets.get(key) || []), event]);
  }

  const candidates: PairCandidate[] = [];
  for (const bucket of Array.from(buckets.values())) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const candidate = scorePair(bucket[i], bucket[j], options);
        if (candidate && candidate.score >= options.minScore) {
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scorePair(left: EventSnapshot, right: EventSnapshot, options: CliOptions): PairCandidate | null {
  const nameSimilarity = similarity(normalizeName(left.nome), normalizeName(right.nome));
  if (nameSimilarity < 0.58) return null;

  const addressSimilarity = similarity(
    normalizeVenueAddress(left.enderecoCompleto || ''),
    normalizeVenueAddress(right.enderecoCompleto || ''),
  );
  const distanceMeters = distanceBetween(left, right);
  const hasCloseGeo = distanceMeters != null && distanceMeters <= options.geoMediumMeters;
  const hasStrongAddress = addressSimilarity >= 0.68;
  if (!hasCloseGeo && !hasStrongAddress) return null;

  const geoScore =
    distanceMeters == null
      ? 0
      : distanceMeters <= options.geoHighMeters
        ? 1
        : Math.max(0, 1 - (distanceMeters - options.geoHighMeters) / (options.geoMediumMeters - options.geoHighMeters));
  const locationScore = Math.max(geoScore, addressSimilarity);
  const sourceScore = left.source && right.source && left.source !== right.source ? 0.04 : 0;
  const exactSourcePenalty = left.source && right.source && left.source === right.source ? -0.03 : 0;
  const score = clamp(round2(nameSimilarity * 0.58 + locationScore * 0.38 + sourceScore + exactSourcePenalty), 0, 1);

  if (score < options.minScore) return null;

  const reasons = [
    `same_date:${dateKey(left.dataInicio)}`,
    `name:${nameSimilarity.toFixed(2)}`,
    `address:${addressSimilarity.toFixed(2)}`,
  ];
  if (distanceMeters != null) reasons.push(`geo:${Math.round(distanceMeters)}m`);
  if (left.source && right.source && left.source !== right.source) reasons.push('cross_source');
  if (left.dedupHash && right.dedupHash && left.dedupHash === right.dedupHash) reasons.push('same_dedup_hash');

  return {
    left,
    right,
    score,
    confidence: score >= options.highScore || (nameSimilarity >= 0.9 && geoScore >= 0.9) ? 'high' : 'medium',
    reasons,
    distanceMeters,
    nameSimilarity,
    addressSimilarity,
  };
}

function buildGroups(candidates: PairCandidate[]): DuplicateGroup[] {
  const adjacency = new Map<string, Set<string>>();
  const byId = new Map<string, EventSnapshot>();
  for (const candidate of candidates) {
    byId.set(candidate.left.id, candidate.left);
    byId.set(candidate.right.id, candidate.right);
    if (!adjacency.has(candidate.left.id)) adjacency.set(candidate.left.id, new Set());
    if (!adjacency.has(candidate.right.id)) adjacency.set(candidate.right.id, new Set());
    adjacency.get(candidate.left.id)?.add(candidate.right.id);
    adjacency.get(candidate.right.id)?.add(candidate.left.id);
  }

  const visited = new Set<string>();
  const groups: DuplicateGroup[] = [];
  for (const id of Array.from(adjacency.keys())) {
    if (visited.has(id)) continue;
    const stack = [id];
    const ids: string[] = [];
    visited.add(id);
    while (stack.length) {
      const current = stack.pop() as string;
      ids.push(current);
      for (const next of Array.from(adjacency.get(current) || [])) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    const groupPairs = candidates.filter((candidate) => ids.includes(candidate.left.id) && ids.includes(candidate.right.id));
    const maxScore = Math.max(...groupPairs.map((pair) => pair.score));
    const sources = Array.from(
      new Set(ids.map((eventId) => byId.get(eventId)?.source || 'unknown').sort()),
    );
    groups.push({
      id: groups.length + 1,
      confidence: groupPairs.some((pair) => pair.confidence === 'high') ? 'high' : 'medium',
      score: maxScore,
      eventIds: ids.sort(),
      pairs: groupPairs,
      sources,
    });
  }

  return groups.sort((a, b) => b.score - a.score);
}

function renderReport(input: {
  generatedAt: string;
  from: Date;
  to: Date;
  options: CliOptions;
  events: EventSnapshot[];
  candidates: PairCandidate[];
  groups: DuplicateGroup[];
}): string {
  const high = input.candidates.filter((candidate) => candidate.confidence === 'high').length;
  const medium = input.candidates.filter((candidate) => candidate.confidence === 'medium').length;
  const sources = countBy(input.events.map((event) => event.source || 'unknown'));
  const savings = input.groups.reduce((sum, group) => sum + Math.max(0, group.eventIds.length - 1), 0);

  return [
    '# Event Dedup Identity Backfill - Dry Run',
    '',
    `Generated at: ${input.generatedAt}`,
    `Window: ${input.from.toISOString()} to ${input.to.toISOString()}`,
    `Mode: ${input.options.apply ? 'apply' : 'dry-run'}`,
    '',
    '## Summary',
    '',
    `- Total events analyzed: ${input.events.length}`,
    `- Suspect groups: ${input.groups.length}`,
    `- High-confidence candidate pairs: ${high}`,
    `- Medium-confidence candidate pairs: ${medium}`,
    `- Possible duplicate savings: ${savings}`,
    `- Sources involved: ${Object.keys(sources).length}`,
    '',
    '## Sources',
    '',
    renderCountTable(sources),
    '',
    '## Suspect Groups',
    '',
    renderGroupTable(input.groups),
    '',
    '## Notes',
    '',
    '- Dry-run only: no events were merged or updated.',
    '- Scoring is local to this script: same calendar date, normalized name similarity, address similarity, and geo distance when coordinates exist.',
    '- Use CSV output for human review before wiring any write path into the event identity service.',
    '',
  ].join('\n');
}

function renderGroupTable(groups: DuplicateGroup[]): string {
  if (!groups.length) return '_No suspect duplicate groups found._';
  return [
    '| Group | Confidence | Score | Size | Sources | Event IDs | Top pair |',
    '|---:|---|---:|---:|---|---|---|',
    ...groups.slice(0, 50).map((group) => {
      const top = group.pairs.sort((a, b) => b.score - a.score)[0];
      return [
        group.id,
        group.confidence,
        group.score.toFixed(2),
        group.eventIds.length,
        group.sources.join(', '),
        group.eventIds.join(' / '),
        `${compact(top.left.nome)} <-> ${compact(top.right.nome)}`,
      ].map(markdownCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |');
    }),
  ].join('\n');
}

function renderCountTable(counts: Record<string, number>): string {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '_No sources found._';
  return [
    '| Source | Events |',
    '|---|---:|',
    ...rows.map(([source, count]) => `| ${markdownCell(source)} | ${count} |`),
  ].join('\n');
}

function writeCsv(filePath: string, candidates: PairCandidate[]): void {
  const header = [
    'confidence',
    'score',
    'left_id',
    'right_id',
    'left_name',
    'right_name',
    'left_date',
    'right_date',
    'distance_meters',
    'name_similarity',
    'address_similarity',
    'left_source',
    'right_source',
    'reasons',
  ];
  const rows = candidates.map((candidate) => [
    candidate.confidence,
    candidate.score.toFixed(2),
    candidate.left.id,
    candidate.right.id,
    candidate.left.nome,
    candidate.right.nome,
    toIso(candidate.left.dataInicio),
    toIso(candidate.right.dataInicio),
    candidate.distanceMeters == null ? '' : Math.round(candidate.distanceMeters).toString(),
    candidate.nameSimilarity.toFixed(3),
    candidate.addressSimilarity.toFixed(3),
    candidate.left.source || '',
    candidate.right.source || '',
    candidate.reasons.join(';'),
  ]);

  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(
    path.resolve(filePath),
    [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'),
    'utf8',
  );
}

function buildWindow(options: CliOptions, now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - options.lookbackDays);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + options.lookaheadDays);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function dateKey(value: Date): string {
  return toIso(value).slice(0, 10);
}

function toIso(value: Date): string {
  return new Date(value).toISOString();
}

function distanceBetween(left: EventSnapshot, right: EventSnapshot): number | null {
  const lat1 = Number(left.latitude);
  const lon1 = Number(left.longitude);
  const lat2 = Number(right.latitude);
  const lon2 = Number(right.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const radius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(value: string): string {
  return normalizeToken(value)
    .replace(/\b(show|evento|festival|oficial|202[0-9]|20[3-9][0-9])\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVenueAddress(value: string): string {
  return normalizeToken(value)
    .replace(/\b(rua|r|avenida|av|alameda|al|praca|pr|numero|n|sao|sp|brasil)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function similarity(left: string, right: string): number {
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const edit = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  const tokens = tokenJaccard(left, right);
  return clamp(round2(edit * 0.55 + tokens * 0.45), 0, 1);
}

function tokenJaccard(left: string, right: string): number {
  const leftSet = new Set(left.split(/\s+/).filter(Boolean));
  const rightSet = new Set(right.split(/\s+/).filter(Boolean));
  const union = new Set(Array.from(leftSet).concat(Array.from(rightSet)));
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of Array.from(leftSet)) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function parseArgs(args: string[]): CliOptions {
  const options = { ...DEFAULT_OPTIONS };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--include-inactive') options.includeInactive = true;
    else if (arg === '--csv') options.csv = requireValue(arg, next, () => index += 1);
    else if (arg === '--limit') options.limit = positiveNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--lookback-days') options.lookbackDays = nonNegativeNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--lookahead-days') options.lookaheadDays = nonNegativeNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--min-score') options.minScore = boundedNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--high-score') options.highScore = boundedNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--geo-high-meters') options.geoHighMeters = positiveNumber(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--geo-medium-meters') options.geoMediumMeters = positiveNumber(arg, requireValue(arg, next, () => index += 1));
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function requireValue(flag: string, value: string | undefined, advance: () => void): string {
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  advance();
  return value;
}

function positiveNumber(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function nonNegativeNumber(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${flag} must be zero or a positive number.`);
  return parsed;
}

function boundedNumber(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${flag} must be between 0 and 1.`);
  return parsed;
}

function usage(): string {
  return [
    'Usage: ts-node -r tsconfig-paths/register scripts/event-dedup-backfill.ts [options]',
    '',
    'Dry-run is the default and the only implemented mode.',
    '',
    'Options:',
    '  --help, -h                 Show help',
    '  --csv <file>               Write pair-level candidate report as CSV',
    '  --limit <n>                Max events to analyze (default: 10000)',
    '  --lookback-days <n>        Include events from the last N days (default: 30)',
    '  --lookahead-days <n>       Include events through the next N days (default: 365)',
    '  --include-inactive         Include inactive events',
    '  --min-score <0..1>         Minimum candidate score (default: 0.72)',
    '  --high-score <0..1>        High-confidence threshold (default: 0.86)',
    '  --geo-high-meters <n>      Strong geo match threshold (default: 250)',
    '  --geo-medium-meters <n>    Medium geo match threshold (default: 750)',
    '  --apply                    Reserved; currently refuses to write',
  ].join('\n');
}

function compact(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}...` : value;
}

function markdownCell(value: string | number): string {
  return String(value).replace(/\|/g, '\\|');
}

function csvCell(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

main().catch((error) => {
  process.stderr.write(`[event-dedup-backfill] ${(error as Error).message}\n`);
  process.exitCode = 1;
});
