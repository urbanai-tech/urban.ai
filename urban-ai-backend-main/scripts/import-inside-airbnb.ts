import 'reflect-metadata';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { AppDataSource } from '../src/data-source';
import { ExternalListing } from '../src/entities/external-listing.entity';
import { InsideAirbnbImportService } from '../src/knn-engine/inside-airbnb-import.service';

/**
 * Importa um listings.csv(.gz) do Inside Airbnb para `external_listing`.
 *
 * Uso:
 *   npx ts-node scripts/import-inside-airbnb.ts --file <path> --city sao-paulo [--source inside-airbnb] [--snapshot 2026-06-01]
 *
 * Baixe o arquivo em https://insideairbnb.com/get-the-data/ (listings.csv.gz).
 */
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const file = arg('file');
  const city = arg('city');
  const source = arg('source', 'inside-airbnb')!;
  const snapshot = arg('snapshot');
  if (!file || !city) {
    console.error('Uso: --file <listings.csv|.gz> --city <slug> [--source ...] [--snapshot YYYY-MM-DD]');
    process.exit(1);
  }

  const raw = fs.readFileSync(file);
  const text = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf-8') : raw.toString('utf-8');

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(ExternalListing);
  const service = new InsideAirbnbImportService(repo as any);

  const res = await service.importFromCsv(text, {
    city,
    source,
    snapshotDate: snapshot ? new Date(snapshot) : null,
  });
  console.log('Resultado:', res);

  const total = await repo.count({ where: { city } });
  console.log(`Total de comps na cidade ${city}: ${total}`);

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error('FALHOU:', e?.message);
  process.exit(1);
});
