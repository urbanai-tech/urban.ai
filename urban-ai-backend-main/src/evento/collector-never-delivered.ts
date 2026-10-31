import { isIgnoredSource, normalizeSourceName } from './collector-zero-yield.service';

/**
 * Zero-yield para fonte NOVA: o detector clássico só alerta fonte que já teve volume ("normalmente
 * ativa"). Aqui cobrimos o contrário: fonte configurada (existe no registro, com as chaves
 * presentes) que NUNCA entregou nenhum evento depois de `days` dias esperando.
 *
 * Config (env, opcionais — ver docs/runbooks/coletores-zero-yield.md):
 *   COLLECTOR_NEVER_DELIVERED_ENABLED   default true
 *   COLLECTOR_NEVER_DELIVERED_DAYS      default 7   (dias de espera desde que a fonte passou a ser esperada)
 */
export interface NeverDeliveredConfig {
  enabled: boolean;
  days: number;
}

export interface ExpectedSourceState {
  source: string;
  /** Desde quando a fonte é esperada (primeira vez vista como configurada). */
  firstExpectedAt: Date;
}

export interface NeverDeliveredFinding {
  source: string;
  daysWaiting: number;
  firstExpectedAt: string;
}

export function readNeverDeliveredConfig(env: NodeJS.ProcessEnv = process.env): NeverDeliveredConfig {
  const days = Number(env.COLLECTOR_NEVER_DELIVERED_DAYS);
  return {
    enabled: (env.COLLECTOR_NEVER_DELIVERED_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    days: Number.isFinite(days) && days > 0 ? days : 7,
  };
}

/**
 * Lógica pura. `deliveredSources` = fontes que já entregaram qualquer item alguma vez (events ou
 * event_sources). Fonte ignorada (curadoria manual) nunca alerta.
 */
export function evaluateNeverDelivered(
  expected: ExpectedSourceState[],
  deliveredSources: Set<string>,
  ignoreSources: string[],
  config: NeverDeliveredConfig,
  now: Date = new Date(),
): NeverDeliveredFinding[] {
  if (!config.enabled) return [];
  const delivered = new Set([...deliveredSources].map(normalizeSourceName));
  const out: NeverDeliveredFinding[] = [];
  for (const item of expected) {
    const source = normalizeSourceName(item.source);
    if (!source || delivered.has(source) || isIgnoredSource(source, ignoreSources)) continue;
    const waitedMs = now.getTime() - item.firstExpectedAt.getTime();
    if (!(waitedMs >= config.days * 86_400_000)) continue;
    out.push({
      source,
      daysWaiting: Math.floor(waitedMs / 86_400_000),
      firstExpectedAt: item.firstExpectedAt.toISOString(),
    });
  }
  return out.sort((a, b) => b.daysWaiting - a.daysWaiting || a.source.localeCompare(b.source));
}

/** Realerta: devolve só os achados cujo último alerta já passou do intervalo (ou nunca houve). */
export function selectDueAlerts<T extends { source: string }>(
  findings: T[],
  lastAlertAt: Map<string, number>,
  realertHours: number,
  now: Date = new Date(),
): T[] {
  return findings.filter((f) => {
    const last = lastAlertAt.get(f.source);
    return last === undefined || now.getTime() - last >= realertHours * 3_600_000;
  });
}
