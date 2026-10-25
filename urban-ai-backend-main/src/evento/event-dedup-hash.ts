import { createHash } from 'crypto';

/**
 * Fórmula ÚNICA do `dedupHash` de eventos (D3): sha256(nome|dia-de-SP|geo ou endereço).
 * Usada por `EventsIngestService` e pelo backfill de datas
 * (`event-date-backfill.ts`), para que um evento corrigido caia no mesmo hash que
 * uma reingestão produziria. `dayKey` é o dia de calendário de São Paulo
 * (`toSaoPauloDateKey`) — nunca o dia UTC.
 */

function cleanName(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function dedupHashByGeo(nome: string, dayKey: string, lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const key = `${cleanName(nome)}|${dayKey}|${roundedLat},${roundedLng}`;
  return createHash('sha256').update(key).digest('hex');
}

export function dedupHashByAddress(nome: string, dayKey: string, endereco: string): string {
  const cleanAddr = endereco.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
  const key = `${cleanName(nome)}|${dayKey}|addr:${cleanAddr}`;
  return createHash('sha256').update(key).digest('hex');
}
