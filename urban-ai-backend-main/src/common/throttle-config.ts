import { Throttle, ThrottlerOptions } from '@nestjs/throttler';

/**
 * Throttlers globais da API (ThrottlerGuard em APP_GUARD, chave = IP real via
 * `trust proxy`). Os nomes importam: o guard só lê os metadados de
 * `@Throttle`/`@SkipThrottle` cujo nome seja de um throttler registrado aqui
 * ("short" e "medium"). `@Throttle({ default: ... })` é ignorado em silêncio,
 * porque não existe throttler "default". Use `PerMinuteThrottle` nas rotas.
 */
export const APP_THROTTLERS: ThrottlerOptions[] = [
  { name: 'short', ttl: 1000, limit: 10 },
  { name: 'medium', ttl: 60_000, limit: 100 },
];

/** Nome do throttler de janela de 1 min (o que os limites por rota sobrescrevem). */
export const PER_MINUTE_THROTTLER = 'medium';

/**
 * Limite por rota, por IP, por minuto. Use em rotas que custam dinheiro a
 * montante (RapidAPI, scraping headless). Sobrescreve o throttler "medium".
 */
export const PerMinuteThrottle = (limit: number) =>
  Throttle({ [PER_MINUTE_THROTTLER]: { ttl: 60_000, limit } });

/** Nomes registrados, usados pelo teste que protege contra chaves inexistentes. */
export const THROTTLER_NAMES = APP_THROTTLERS.map((t) => t.name as string);
