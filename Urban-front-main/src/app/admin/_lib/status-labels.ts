/**
 * Mapa único de rótulos pt-BR para valores crus de status/ciclo/papel que vêm
 * da API. Só apresentação: os valores enviados/recebidos continuam os mesmos
 * (ex.: `value="past_due"` num filtro; o texto exibido vem daqui).
 */

const STATUS_LABELS: Record<string, string> = {
  // Assinatura / cobrança
  active: "Ativo",
  inactive: "Inativo",
  trialing: "Em teste",
  trial: "Em teste",
  trial_expired: "Teste expirado",
  past_due: "Pagamento falhou",
  canceled: "Cancelado",
  cancelled: "Cancelado",
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
  expired: "Expirado",
  unpaid: "Não pago",
  paused: "Pausado",
  none: "Sem assinatura",
  alpha: "Alpha",
  // Execuções / jobs
  success: "Sucesso",
  error: "Erro",
  failed: "Falhou",
  running: "Em execução",
  pending: "Pendente",
  skipped: "Ignorado",
  sent: "Enviado",
  // Resultados de reserva
  booked: "Reservado",
  not_booked: "Não reservado",
  blocked: "Bloqueado",
  unknown: "Desconhecido",
  // Cadastro de eventos / regiões
  created: "Criado",
  updated: "Atualizado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  bootstrap: "Em implantação",
  ready: "Pronto",
  // Modo de operação e estratégia de preço do anfitrião
  notifications: "Notificações",
  auto: "Automático",
  conservative: "Conservadora",
  balanced: "Moderada",
  aggressive: "Agressiva",
  ai: "IA",
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "mensal",
  quarterly: "trimestral",
  semestral: "semestral",
  annual: "anual",
  yearly: "anual",
  // Recorrência de custos da plataforma (finance)
  usage_based: "por uso",
  one_time: "único",
  percentual: "% receita",
};

const ROLE_LABELS: Record<string, string> = {
  host: "Anfitrião",
  admin: "Administrador",
  support: "Suporte",
};

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

/** Rótulo pt-BR de um status; valor desconhecido vira texto legível (sem `_`). */
export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return STATUS_LABELS[value] ?? humanize(value);
}

/** "monthly" → "mensal" (minúsculo, para compor frases como "Plano · mensal"). */
export function cycleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return CYCLE_LABELS[value] ?? value;
}

/** "host" → "Anfitrião". Valor enviado à API segue sendo o cru. */
export function roleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ROLE_LABELS[value] ?? humanize(value);
}
