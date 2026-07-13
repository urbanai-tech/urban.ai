import 'reflect-metadata';
import { AppDataSource } from '../src/data-source';
import { Event } from '../src/entities/events.entity';
import { EventHistoricalMultiplier } from '../src/entities/event-historical-multiplier.entity';
import { AnalisePreco } from '../src/entities/AnalisePreco';
import { EventIdentityService } from '../src/evento/event-identity.service';
import { VenueCapacityService } from '../src/knn-engine/venue-capacity.service';
import { EventHistoricalService } from '../src/knn-engine/event-historical.service';

async function main() {
  await AppDataSource.initialize();
  const eventRepo = AppDataSource.getRepository(Event);
  const anchorRepo = AppDataSource.getRepository(EventHistoricalMultiplier);
  const analiseRepo = AppDataSource.getRepository(AnalisePreco);
  const identity = new EventIdentityService();

  const venue = new VenueCapacityService(eventRepo as any, identity);
  const historical = new EventHistoricalService(
    eventRepo as any,
    anchorRepo as any,
    analiseRepo as any,
    identity,
  );

  console.log('\n== 1. seedCuratedAnchors ==');
  console.log(await historical.seedCuratedAnchors());

  console.log('\n== 2. importFromWikidata (rede) ==');
  console.log(await historical.importFromWikidata());

  console.log('\n== 3. venue backfillAll ==');
  console.log(await venue.backfillAll());

  console.log('\n== 4. applyAnchorsAll ==');
  console.log(await historical.applyAnchorsAll());

  console.log('\n== RESULTADO: eventos ==');
  const events = await eventRepo.find();
  for (const e of events) {
    console.log(
      `  ${e.id.padEnd(16)} venueCap=${String(e.venueCapacity ?? '-').padStart(7)} venueType=${(e.venueType ?? '-').padEnd(18)} hist=${String(e.historicalAttendance ?? '-').padStart(7)}`,
    );
  }

  console.log('\n== RESULTADO: âncoras (top por público) ==');
  const anchors = await anchorRepo.find({ order: { realAttendance: 'DESC' } });
  for (const a of anchors.slice(0, 12)) {
    console.log(
      `  ${a.canonicalName.slice(0, 28).padEnd(28)} att=${String(a.realAttendance ?? '-').padStart(8)} src=${a.source} n=${a.sampleSize}`,
    );
  }
  console.log(`  ...total âncoras: ${anchors.length}`);

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error('FALHOU:', e?.message);
  process.exit(1);
});
