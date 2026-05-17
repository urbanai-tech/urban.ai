/**
 * Backfill Geocoder — script standalone.
 *
 * Resolve o gap H1 do roadmap: "16/29 imoveis com cidade 'A definir' e
 * estado 'A '". Reativa coordenadas + cidade/UF para imoveis que ainda
 * nao foram geocodificados (ou tiveram falha).
 *
 * Como rodar:
 *   1. Ativar Geocoding API no Google Cloud Console + billing.
 *   2. Configurar GOOGLE_MAPS_API_KEY com acesso ao servico (server-side, sem
 *      restricao IP/HTTP referer ou whitelist do IP da Railway).
 *   3. `npm run backfill:geocoder` (adicione o script em package.json se ainda
 *      nao existir) OU `npx ts-node scripts/backfill-geocoder.ts`.
 *
 * Idempotente: skip de imoveis ja com coords ou ja tentados em janela recente.
 * Rate limit: 1 req/seg por padrao (config GEOCODER_BACKFILL_RPS).
 *
 * Modos:
 *  - `DRY_RUN=true npx ts-node scripts/backfill-geocoder.ts` — so loga sem
 *    chamar Google nem persistir.
 *  - `LIMIT=10 npx ts-node scripts/backfill-geocoder.ts` — processa apenas
 *    os primeiros N imoveis (default: todos elegiveis).
 */

import 'reflect-metadata';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { Address } from '../src/entities/addresses.entity';
import { List } from '../src/entities/list.entity';
import { User } from '../src/entities/user.entity';

type GeocodeResult = {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  country: string | null;
  formatted: string | null;
};

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DRY_RUN =
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' ||
  process.argv.includes('--dry-run');
const LIMIT = Number(process.env.LIMIT || 0); // 0 = sem limite
const RPS = Number(process.env.GEOCODER_BACKFILL_RPS || 1); // requisicoes por segundo
const SLEEP_MS = Math.max(50, Math.round(1000 / RPS));

const COLOR_OK = '\x1b[32m';
const COLOR_WARN = '\x1b[33m';
const COLOR_ERR = '\x1b[31m';
const COLOR_DIM = '\x1b[2m';
const COLOR_RESET = '\x1b[0m';

function log(kind: 'ok' | 'warn' | 'err' | 'info', msg: string) {
  const color =
    kind === 'ok'
      ? COLOR_OK
      : kind === 'warn'
        ? COLOR_WARN
        : kind === 'err'
          ? COLOR_ERR
          : COLOR_DIM;
  // eslint-disable-next-line no-console
  console.log(`${color}[backfill-geocoder]${COLOR_RESET} ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY ausente — script nao pode chamar Google.');
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const res = await axios.get(url, {
    params: { address, key: API_KEY, region: 'br', language: 'pt-BR' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const data = res.data;
  if (data?.status === 'REQUEST_DENIED') {
    throw new Error(
      `Google REQUEST_DENIED: ${data?.error_message ?? 'verifique Geocoding API ativa + billing + restricao da key'}`,
    );
  }
  if (data?.status !== 'OK' || !data?.results?.length) {
    return null;
  }

  const top = data.results[0];
  const loc = top.geometry?.location;
  if (loc == null) return null;

  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;
  for (const comp of top.address_components ?? []) {
    const types: string[] = comp.types ?? [];
    if (types.includes('administrative_area_level_2') || types.includes('locality')) {
      city = city ?? comp.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      state = comp.short_name ?? comp.long_name;
    }
    if (types.includes('country')) {
      country = comp.short_name ?? comp.long_name;
    }
  }

  return {
    lat: loc.lat,
    lng: loc.lng,
    city,
    state,
    country,
    formatted: top.formatted_address ?? null,
  };
}

function isInvalidLocality(addr: Address): boolean {
  const city = ((addr as any).cidade || (addr as any).city || '').trim();
  const state = ((addr as any).estado || (addr as any).state || '').trim();
  const lat = Number((addr as any).latitude ?? 0);
  const lng = Number((addr as any).longitude ?? 0);

  if (!city || /^a\s*definir$/i.test(city)) return true;
  if (!state || state.length === 0 || /^a\s*$/i.test(state)) return true;
  if (lat === 0 || lng === 0) return true;
  return false;
}

function composeQuery(addr: Address): string {
  const a = addr as any;
  return (
    [a.logradouro, a.numero, a.bairro, a.cidade, a.estado, a.cep]
      .filter((p: any) => p && String(p).trim().length > 0)
      .join(', ') || a.enderecoCompleto || ''
  );
}

async function main(): Promise<void> {
  if (!API_KEY && !DRY_RUN) {
    log(
      'err',
      'GOOGLE_MAPS_API_KEY nao definida. Ative a Geocoding API no GCP, exporte a env e rode de novo. Ou use DRY_RUN=true.',
    );
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'mysql',
    url: process.env.DATABASE_URL,
    entities: [Address, List, User],
    synchronize: false,
    logging: false,
  });

  log('info', `conectando ao DB...`);
  await dataSource.initialize();
  log('ok', `DB conectado`);

  const addressRepo = dataSource.getRepository(Address);
  const all = await addressRepo.find();
  log('info', `${all.length} imoveis encontrados no total`);

  let eligible = all.filter(isInvalidLocality);
  if (LIMIT > 0) eligible = eligible.slice(0, LIMIT);
  log('info', `${eligible.length} imoveis elegiveis pra backfill (cidade='A definir' ou sem coords)`);

  if (DRY_RUN) {
    log('warn', 'DRY_RUN=true — nao vou chamar Google nem salvar nada');
    for (const addr of eligible) {
      const q = composeQuery(addr);
      log('info', `  [DRY] ${addr.id} → query: "${q}"`);
    }
    await dataSource.destroy();
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < eligible.length; i++) {
    const addr = eligible[i];
    const query = composeQuery(addr);
    if (!query || query.length < 5) {
      log('warn', `[${i + 1}/${eligible.length}] ${addr.id} — query vazia, skip`);
      skipped++;
      continue;
    }

    try {
      const result = await geocodeAddress(query);
      if (!result) {
        log('warn', `[${i + 1}/${eligible.length}] ${addr.id} — Google nao retornou resultado`);
        failed++;
        await sleep(SLEEP_MS);
        continue;
      }

      // Persiste — usa campos cujo nome real da entidade Address.
      const a = addr as any;
      a.latitude = result.lat;
      a.longitude = result.lng;
      if (result.city) a.cidade = result.city;
      if (result.state) a.estado = result.state;

      await addressRepo.save(addr);
      log(
        'ok',
        `[${i + 1}/${eligible.length}] ${addr.id} → ${result.city}/${result.state} (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`,
      );
      success++;
    } catch (err) {
      const msg = (err as Error)?.message ?? 'erro desconhecido';
      log('err', `[${i + 1}/${eligible.length}] ${addr.id} — ${msg}`);
      failed++;

      // Se o erro for REQUEST_DENIED, abortamos — provavel API inativa
      if (msg.includes('REQUEST_DENIED')) {
        log('err', '*** Abortando — Geocoding API parece bloqueada. Confirme no GCP Console. ***');
        break;
      }
    }

    await sleep(SLEEP_MS);
  }

  log('info', '');
  log('info', '=== RESUMO ===');
  log('info', `Elegiveis  : ${eligible.length}`);
  log('ok', `Sucesso   : ${success}`);
  log('warn', `Sem match : ${failed}`);
  log('warn', `Pulados   : ${skipped}`);
  log('info', '');
  log('info', 'Proximo passo: rodar /admin/jobs > "Reset enrichment stale" pra reprocessar recomendacoes.');

  await dataSource.destroy();
}

main().catch((err) => {
  log('err', `Fatal: ${err?.message ?? err}`);
  process.exit(1);
});
