/**
 * Resolve o valor de `trust proxy` do Express a partir do ambiente.
 *
 * Atrás do proxy da Railway, sem `trust proxy` o `req.ip` é sempre o IP do
 * proxy e o ThrottlerGuard (que usa `req.ip`) throttla todos os clientes juntos.
 *
 * - `TRUST_PROXY_HOPS` numérico: número de proxies confiáveis (0 desliga).
 * - `TRUST_PROXY_HOPS=false`: desliga.
 * - `TRUST_PROXY_HOPS=<lista de IPs/CIDRs/nomes do Express>`: repassado como está.
 * - `TRUST_PROXY_HOPS=true` é rejeitado (qualquer cliente forjaria X-Forwarded-For).
 * - Não definido: 1 hop em produção (Railway), desligado fora dela.
 */
export function resolveTrustProxy(
  env: NodeJS.ProcessEnv = process.env,
): number | boolean | string {
  const raw = (env.TRUST_PROXY_HOPS ?? '').trim();
  const appEnv = env.APP_ENV || env.NODE_ENV || 'development';
  const defaultValue = appEnv === 'production' ? 1 : false;

  if (raw === '') return defaultValue;

  const lowered = raw.toLowerCase();
  if (lowered === 'false') return false;
  if (lowered === 'true') {
    console.warn(
      '[TRUST_PROXY] TRUST_PROXY_HOPS=true é inseguro (X-Forwarded-For forjável); usando o default.',
    );
    return defaultValue;
  }

  if (/^\d+$/.test(raw)) {
    const hops = parseInt(raw, 10);
    return hops === 0 ? false : hops;
  }

  // Lista de IPs/CIDRs/nomes (loopback, linklocal, uniquelocal) aceita pelo Express.
  return raw;
}
