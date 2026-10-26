/**
 * Mapeamento PURO (sem I/O) usuário + Payments -> linha do painel de cobrança assistida.
 *
 * Reaproveita `evaluateEntitlement` (a mesma regra do guard 402) para decidir se o anfitrião
 * tem direito de uso e por quê; este módulo só traduz isso em um estado operacional para o
 * admin acompanhar os anfitriões do beta e dar o empurrão certo.
 */
import {
  EntitlementDecision,
  PaymentLike,
  evaluateEntitlement,
  resolveAlphaQuota,
  resolveGraceDays,
} from '../subscription/entitlement';

const DAY_MS = 24 * 60 * 60 * 1000;

export type BillingHostStatus =
  | 'alpha' // acesso concedido à mão (ALPHA_USER_QUOTAS ou Payment 'alpha'): não cobra
  | 'trialing' // trial em andamento
  | 'trial_expired' // trial acabou sem virar assinatura
  | 'active' // assinatura em dia
  | 'past_due' // cobrança falhou (com ou sem carência)
  | 'canceled'
  | 'incomplete' // checkout aberto e não concluído / unpaid / paused
  | 'expired' // período pago acabou sem renovar
  | 'none' // nunca iniciou checkout
  | 'inactive'; // conta desativada

export type BillingHostPaymentInput = PaymentLike & {
  id?: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  planName?: string | null;
  billingCycle?: string | null;
  startDate?: Date | string | null;
  createdAt?: Date | string | null;
  trialUsedAt?: Date | string | null;
};

export type BillingHostUserInput = {
  id: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  ativo?: boolean | null;
  createdAt?: Date | string | null;
};

export type BillingHostRow = {
  userId: string;
  name: string;
  email: string;
  createdAt: string | null;
  status: BillingHostStatus;
  statusLabel: string;
  entitled: boolean;
  entitlementReason: string;
  /** Dias até o fim do trial (arredondado para cima, mín. 0); só quando `status === 'trialing'`. */
  trialDaysLeft: number | null;
  /** Fim do período corrente (trial ou ciclo pago), `null` se desconhecido. */
  periodEnd: string | null;
  /** Fim da carência para `past_due`. */
  graceEndsAt: string | null;
  planName: string | null;
  billingCycle: string | null;
  listingsContratados: number | null;
  /** Início do período corrente segundo o Stripe (`Payment.startDate`); `null` se desconhecido. */
  periodStart: string | null;
  /** Último evento de cobrança aplicado (webhook Stripe) em `Payment.updatedAt`. */
  lastBillingEventAt: string | null;
  hasStripeCustomer: boolean;
  /** Precisa de atenção do admin (cobrança falhou, trial acabando/vencido, checkout parado). */
  needsAttention: boolean;
  attentionReason: string | null;
  /** O que o botão "reenviar link" vai mandar. */
  suggestedLink: 'portal' | 'checkout';
};

export type BillingHostsSummary = {
  total: number;
  needsAttention: number;
  byStatus: Record<BillingHostStatus, number>;
};

const STATUS_LABELS: Record<BillingHostStatus, string> = {
  alpha: 'Acesso alpha (sem cobrança)',
  trialing: 'Em trial',
  trial_expired: 'Trial encerrado',
  active: 'Ativo',
  past_due: 'Pagamento falhou',
  canceled: 'Cancelado',
  incomplete: 'Checkout não concluído',
  expired: 'Período vencido',
  none: 'Sem assinatura',
  inactive: 'Conta desativada',
};

/** Dias de trial restantes que ainda contam como "acabando". */
export const TRIAL_ENDING_SOON_DAYS = 3;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value: Date | string | null | undefined): string | null {
  return toDate(value)?.toISOString() ?? null;
}

function timeOf(payment: BillingHostPaymentInput): number {
  return toDate(payment.updatedAt)?.getTime() ?? toDate(payment.createdAt)?.getTime() ?? 0;
}

export function latestPayment(payments: BillingHostPaymentInput[]): BillingHostPaymentInput | null {
  if (!payments.length) return null;
  return [...payments].sort((a, b) => timeOf(b) - timeOf(a))[0];
}

export function classifyBillingStatus(
  decision: EntitlementDecision,
  latest: BillingHostPaymentInput | null,
): BillingHostStatus {
  switch (decision.reason) {
    case 'alpha_env':
    case 'alpha_payment':
      return 'alpha';
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due_in_grace':
    case 'past_due_grace_expired':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'not_paid':
      return 'incomplete';
    case 'period_expired': {
      const status = String(latest?.status ?? '').toLowerCase();
      return status === 'trialing' ? 'trial_expired' : 'expired';
    }
    case 'no_subscription':
      return 'none';
    case 'user_inactive':
      return 'inactive';
    default:
      return 'none';
  }
}

export function mapBillingHostRow(
  user: BillingHostUserInput,
  payments: BillingHostPaymentInput[],
  options: { now?: Date; alphaQuotasRaw?: string; graceDays?: number } = {},
): BillingHostRow {
  const now = options.now ?? new Date();
  const decision = evaluateEntitlement({
    role: user.role,
    ativo: user.ativo,
    alphaQuota: resolveAlphaQuota(options.alphaQuotasRaw, user.id, user.email),
    payments,
    now,
    graceDays: options.graceDays ?? resolveGraceDays(),
  });
  const latest = latestPayment(payments);
  const status = classifyBillingStatus(decision, latest);

  const periodEndDate = toDate(latest?.expireDate);
  const trialDaysLeft =
    status === 'trialing' && periodEndDate
      ? Math.max(0, Math.ceil((periodEndDate.getTime() - now.getTime()) / DAY_MS))
      : null;

  let attentionReason: string | null = null;
  if (status === 'past_due') attentionReason = 'Cobrança falhou: o acesso segue só durante a carência.';
  else if (status === 'trial_expired') attentionReason = 'Trial acabou sem virar assinatura.';
  else if (status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= TRIAL_ENDING_SOON_DAYS) {
    attentionReason = trialDaysLeft === 0 ? 'Trial termina hoje.' : `Trial termina em ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}.`;
  } else if (status === 'incomplete') attentionReason = 'Checkout iniciado e não concluído.';
  else if (status === 'expired') attentionReason = 'Período pago venceu sem renovação.';
  else if (status === 'none') attentionReason = 'Ainda não iniciou o checkout.';

  const hasStripeCustomer = payments.some((payment) => Boolean(payment.customerId));
  // Portal só faz sentido enquanto existe assinatura viva para gerenciar; nos demais casos
  // o caminho é um checkout novo (trial se ainda não usou, plano pago caso contrário).
  const suggestedLink: 'portal' | 'checkout' =
    hasStripeCustomer && (status === 'active' || status === 'trialing' || status === 'past_due') ? 'portal' : 'checkout';

  return {
    userId: user.id,
    name: user.username || '',
    email: user.email || '',
    createdAt: iso(user.createdAt),
    status,
    statusLabel: STATUS_LABELS[status],
    entitled: decision.entitled,
    entitlementReason: decision.reason,
    trialDaysLeft,
    periodEnd: iso(latest?.expireDate),
    graceEndsAt: iso(decision.graceEndsAt),
    planName: latest?.planName ?? null,
    billingCycle: latest?.billingCycle ?? null,
    listingsContratados: latest?.listingsContratados ?? null,
    periodStart: iso(latest?.startDate),
    lastBillingEventAt: iso(latest?.updatedAt),
    hasStripeCustomer,
    needsAttention: attentionReason !== null,
    attentionReason,
    suggestedLink,
  };
}

const ATTENTION_ORDER: BillingHostStatus[] = [
  'past_due',
  'trial_expired',
  'trialing',
  'incomplete',
  'expired',
  'none',
  'canceled',
  'active',
  'alpha',
  'inactive',
];

/** Atenção primeiro; dentro do trial, quem vence antes aparece antes. */
export function sortBillingHostRows(rows: BillingHostRow[]): BillingHostRow[] {
  return [...rows].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    const byStatus = ATTENTION_ORDER.indexOf(a.status) - ATTENTION_ORDER.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    if (a.status === 'trialing') return (a.trialDaysLeft ?? 0) - (b.trialDaysLeft ?? 0);
    return a.email.localeCompare(b.email);
  });
}

export function summarizeBillingHosts(rows: BillingHostRow[]): BillingHostsSummary {
  const byStatus = Object.fromEntries(Object.keys(STATUS_LABELS).map((key) => [key, 0])) as Record<BillingHostStatus, number>;
  for (const row of rows) byStatus[row.status] += 1;
  return {
    total: rows.length,
    needsAttention: rows.filter((row) => row.needsAttention).length,
    byStatus,
  };
}

export function maskEmail(email: string): string {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
