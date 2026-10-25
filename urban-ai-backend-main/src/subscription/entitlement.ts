/**
 * Regra pura de "direito de uso pago" (entitlement) do Urban AI.
 *
 * Sem I/O: recebe o estado já carregado (papel do usuário, cota alpha, linhas de
 * Payment) e devolve a decisão. Assim a regra é testável sem banco e idêntica
 * para o guard HTTP, os crons e o reconciliador de cota.
 *
 * Quem tem acesso:
 *  - admin (role) — sempre, sem cota;
 *  - alpha explícito: e-mail/id listado em ALPHA_USER_QUOTAS ou Payment.status = 'alpha';
 *  - assinatura Stripe `active` / `trialing` dentro do período (expireDate + carência);
 *  - `past_due` enquanto durar a carência (SUBSCRIPTION_GRACE_DAYS, padrão 3 dias).
 *
 * Quem NÃO tem: sem Payment, `pending`, `canceled`, `unpaid`, `incomplete*`,
 * `paused`, e qualquer status acima fora do período + carência.
 */

export const DEFAULT_SUBSCRIPTION_GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type EntitlementSource = 'admin' | 'alpha_env' | 'alpha_payment' | 'subscription' | 'none';

export type EntitlementReason =
  | 'admin'
  | 'alpha_env'
  | 'alpha_payment'
  | 'active'
  | 'trialing'
  | 'past_due_in_grace'
  | 'user_inactive'
  | 'no_subscription'
  | 'past_due_grace_expired'
  | 'period_expired'
  | 'canceled'
  | 'not_paid';

export interface PaymentLike {
  status?: string | null;
  expireDate?: Date | string | null;
  listingsContratados?: number | null;
  updatedAt?: Date | string | null;
}

export interface EntitlementInput {
  role?: string | null;
  /** `false` = conta desativada; qualquer outro valor (inclusive undefined) é tratado como ativa. */
  ativo?: boolean | null;
  /** Cota vinda de ALPHA_USER_QUOTAS para este usuário (null/undefined = não listado). */
  alphaQuota?: number | null;
  payments: PaymentLike[];
  now?: Date;
  graceDays?: number;
}

export interface EntitlementDecision {
  entitled: boolean;
  reason: EntitlementReason;
  source: EntitlementSource;
  /** Imóveis permitidos. `null` = sem limite (admin) ou sem direito algum (entitled=false => 0). */
  quota: number | null;
  /** Status bruto do Payment que decidiu (quando houve). */
  status?: string;
  /** Fim da carência para past_due (informativo, para a UI/mensagens). */
  graceEndsAt?: Date;
  /** `true` se o usuário já teve alguma linha de Payment (histórico de cobrança). */
  hasBillingHistory: boolean;
}

/** Lê SUBSCRIPTION_GRACE_DAYS; inválido/negativo cai no padrão. 0 desliga a carência. */
export function resolveGraceDays(raw: string | undefined = process.env.SUBSCRIPTION_GRACE_DAYS): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_SUBSCRIPTION_GRACE_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SUBSCRIPTION_GRACE_DAYS;
  return Math.min(Math.floor(parsed), 60);
}

/**
 * Resolve a cota alpha (formato `chave:cota,chave2:cota2`, chave = id ou e-mail,
 * case-insensitive) — mesma sintaxe de ALPHA_USER_QUOTAS usada pelo PaymentsService.
 */
export function resolveAlphaQuota(
  raw: string | undefined,
  userId: string,
  email?: string | null,
): number | null {
  if (!raw || !raw.trim()) return null;
  const keys = new Set([userId?.toLowerCase(), email?.toLowerCase()].filter(Boolean) as string[]);

  for (const entry of raw.split(',')) {
    const [rawKey, rawQuota] = entry.split(':').map((part) => part?.trim());
    if (!rawKey || !rawQuota) continue;
    if (!keys.has(rawKey.toLowerCase())) continue;

    const quota = Number(rawQuota);
    return Number.isFinite(quota) && quota > 0 ? Math.floor(quota) : null;
  }
  return null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paymentQuota(payment: PaymentLike): number {
  return Math.max(1, Math.floor(Number(payment.listingsContratados ?? 1)) || 1);
}

interface PaymentVerdict {
  entitled: boolean;
  reason: EntitlementReason;
  graceEndsAt?: Date;
}

function judgePayment(payment: PaymentLike, now: Date, graceMs: number): PaymentVerdict {
  const status = String(payment.status ?? '').toLowerCase();
  const expire = toDate(payment.expireDate);

  switch (status) {
    case 'active':
    case 'trialing':
    case 'alpha': {
      // expireDate vazio = sem prazo conhecido (ex.: alpha concedido à mão): vale.
      if (expire && expire.getTime() + graceMs < now.getTime()) {
        return { entitled: false, reason: 'period_expired' };
      }
      return {
        entitled: true,
        reason: status === 'alpha' ? 'alpha_payment' : status === 'trialing' ? 'trialing' : 'active',
      };
    }
    case 'past_due': {
      // Cobrança falhou: o acesso segue por `graceDays` a partir do fim do período pago.
      const base = expire ?? toDate(payment.updatedAt);
      if (!base) return { entitled: false, reason: 'past_due_grace_expired' };
      const graceEndsAt = new Date(base.getTime() + graceMs);
      return graceEndsAt.getTime() >= now.getTime()
        ? { entitled: true, reason: 'past_due_in_grace', graceEndsAt }
        : { entitled: false, reason: 'past_due_grace_expired', graceEndsAt };
    }
    case 'canceled':
      return { entitled: false, reason: 'canceled' };
    default:
      // pending, unpaid, incomplete, incomplete_expired, paused, desconhecido
      return { entitled: false, reason: 'not_paid' };
  }
}

export function evaluateEntitlement(input: EntitlementInput): EntitlementDecision {
  const now = input.now ?? new Date();
  const graceDays = input.graceDays ?? resolveGraceDays();
  const graceMs = Math.max(0, graceDays) * DAY_MS;
  const payments = input.payments ?? [];
  const hasBillingHistory = payments.length > 0;

  if (input.ativo === false) {
    return { entitled: false, reason: 'user_inactive', source: 'none', quota: 0, hasBillingHistory };
  }

  if (input.role === 'admin') {
    return { entitled: true, reason: 'admin', source: 'admin', quota: null, hasBillingHistory };
  }

  if (input.alphaQuota && input.alphaQuota > 0) {
    return {
      entitled: true,
      reason: 'alpha_env',
      source: 'alpha_env',
      quota: Math.floor(input.alphaQuota),
      hasBillingHistory,
    };
  }

  if (!hasBillingHistory) {
    return { entitled: false, reason: 'no_subscription', source: 'none', quota: 0, hasBillingHistory };
  }

  const judged = payments.map((payment) => ({ payment, verdict: judgePayment(payment, now, graceMs) }));
  const winners = judged
    .filter((item) => item.verdict.entitled)
    .sort(
      (a, b) =>
        (toDate(b.payment.updatedAt)?.getTime() ?? 0) - (toDate(a.payment.updatedAt)?.getTime() ?? 0),
    );

  if (winners.length > 0) {
    const { payment, verdict } = winners[0];
    return {
      entitled: true,
      reason: verdict.reason,
      source: verdict.reason === 'alpha_payment' ? 'alpha_payment' : 'subscription',
      quota: paymentQuota(payment),
      status: String(payment.status ?? '').toLowerCase(),
      graceEndsAt: verdict.graceEndsAt,
      hasBillingHistory,
    };
  }

  // Ninguém tem direito: explica pelo Payment mais recente.
  const latest = [...judged].sort(
    (a, b) => (toDate(b.payment.updatedAt)?.getTime() ?? 0) - (toDate(a.payment.updatedAt)?.getTime() ?? 0),
  )[0];
  return {
    entitled: false,
    reason: latest.verdict.reason,
    source: 'none',
    quota: 0,
    status: String(latest.payment.status ?? '').toLowerCase(),
    graceEndsAt: latest.verdict.graceEndsAt,
    hasBillingHistory,
  };
}
