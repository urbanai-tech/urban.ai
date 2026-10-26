// Plano B do scraping (ADR 0010): regras puras do formulário "Preencher manualmente"
// e do texto que diz de onde veio a diária base. Sem dependências para ser testável
// com `node --test` (ver scripts/host-baseline.test.mjs).

export type BaselineSource = "airbnb" | "host_input" | null;

export type PropertyBaselineView = {
  dailyPrice: number | null;
  source: BaselineSource;
  updatedAt: string | null;
  stale: boolean;
  essentialsSource?: string | null;
};

export type HostBaselineDraft = {
  manualDailyPrice: string;
  minDailyPrice: string;
  weekendDailyPrice: string;
  quartos: string;
  camas: string;
  banheiros: string;
  hospedes: string;
  propertyType: string;
};

export type HostBaselinePayload = {
  manualDailyPrice: number;
  minDailyPrice?: number;
  weekendDailyPrice?: number;
  quartos?: number;
  camas?: number;
  banheiros?: number;
  hospedes?: number;
  propertyType?: string;
};

export type HostBaselineParseResult =
  | { ok: true; payload: HostBaselinePayload }
  | { ok: false; error: string };

export const EMPTY_HOST_BASELINE_DRAFT: HostBaselineDraft = {
  manualDailyPrice: "",
  minDailyPrice: "",
  weekendDailyPrice: "",
  quartos: "",
  camas: "",
  banheiros: "",
  hospedes: "",
  propertyType: "",
};

/** Aceita "R$ 1.234,56", "350,5" ou "350.5"; recusa zero, negativo e texto. */
export function parseBaselineMoney(value: string): number | null {
  const sanitized = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!sanitized) return null;
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(sanitized)
      ? sanitized.replace(/\./g, "")
      : sanitized;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100000 ? Number(parsed.toFixed(2)) : null;
}

function parseCount(value: string, { min, max, allowHalf }: { min: number; max: number; allowHalf?: boolean }): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return Number.NaN;
  if (!allowHalf && !Number.isInteger(parsed)) return Number.NaN;
  if (allowHalf && !Number.isInteger(parsed * 2)) return Number.NaN;
  return parsed;
}

export function parseHostBaselineDraft(draft: HostBaselineDraft): HostBaselineParseResult {
  const manualDailyPrice = parseBaselineMoney(draft.manualDailyPrice);
  if (!manualDailyPrice) {
    return { ok: false, error: "Informe a diária base atual do imóvel (um valor maior que zero)." };
  }

  const payload: HostBaselinePayload = { manualDailyPrice };

  if (draft.minDailyPrice.trim()) {
    const min = parseBaselineMoney(draft.minDailyPrice);
    if (!min) return { ok: false, error: "A diária mínima precisa ser um valor válido." };
    if (min > manualDailyPrice) {
      return { ok: false, error: "A diária mínima não pode ser maior que a diária base." };
    }
    payload.minDailyPrice = min;
  }

  if (draft.weekendDailyPrice.trim()) {
    const weekend = parseBaselineMoney(draft.weekendDailyPrice);
    if (!weekend) return { ok: false, error: "A diária de fim de semana precisa ser um valor válido." };
    payload.weekendDailyPrice = weekend;
  }

  const counts: Array<[keyof HostBaselinePayload, string, string, { min: number; max: number; allowHalf?: boolean }]> = [
    ["quartos", draft.quartos, "Quartos", { min: 0, max: 100 }],
    ["camas", draft.camas, "Camas", { min: 0, max: 100 }],
    ["banheiros", draft.banheiros, "Banheiros", { min: 0, max: 100, allowHalf: true }],
    ["hospedes", draft.hospedes, "Hóspedes", { min: 1, max: 100 }],
  ];
  for (const [field, raw, label, bounds] of counts) {
    const parsed = parseCount(raw, bounds);
    if (parsed === null) continue;
    if (Number.isNaN(parsed)) return { ok: false, error: `${label}: informe um número válido.` };
    (payload as Record<string, unknown>)[field] = parsed;
  }

  const propertyType = draft.propertyType.trim();
  if (propertyType) payload.propertyType = propertyType.slice(0, 60);

  return { ok: true, payload };
}

function formatDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export type BaselineSourceCopy = {
  label: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
};

/** Texto honesto sobre a origem da diária base exibida no imóvel. */
export function describeBaselineSource(baseline: PropertyBaselineView | null | undefined): BaselineSourceCopy {
  if (!baseline || baseline.source === null || !baseline.dailyPrice) {
    return {
      label: "Sem diária base",
      detail: "Não temos uma diária confirmada para este imóvel. Preencha manualmente para liberar as sugestões.",
      tone: "warning",
    };
  }

  const day = formatDay(baseline.updatedAt);

  if (baseline.source === "host_input") {
    return {
      label: "Informada por você",
      detail: day
        ? `Valor que você informou em ${day}. Atualize quando mudar o preço no Airbnb.`
        : "Valor que você informou. Atualize quando mudar o preço no Airbnb.",
      tone: "success",
    };
  }

  if (baseline.stale) {
    return {
      label: "Leitura do Airbnb desatualizada",
      detail: day
        ? `Última leitura do Airbnb em ${day}. Confira o valor ou preencha manualmente.`
        : "Leitura do Airbnb sem data confirmada. Confira o valor ou preencha manualmente.",
      tone: "warning",
    };
  }

  return {
    label: "Lida do Airbnb",
    detail: day ? `Última leitura do Airbnb em ${day}.` : "Leitura recente do Airbnb.",
    tone: "neutral",
  };
}

/** Rótulo curto para a origem dos dados essenciais (quartos, camas, banheiros...). */
export function describeEssentialsSource(source: string | null | undefined): string {
  if (source === "host_input") return "Dados do imóvel informados por você";
  if (source === "airbnb") return "Dados do imóvel lidos do Airbnb";
  return "Origem dos dados do imóvel não registrada";
}

export function draftFromBaseline(
  list:
    | {
        manualDailyPrice?: number | null;
        minDailyPrice?: number | null;
        weekendDailyPrice?: number | null;
        quartos?: number | null;
        camas?: number | null;
        banheiros?: number | null;
        hospedes?: number | null;
        propertyType?: string | null;
      }
    | null
    | undefined,
): HostBaselineDraft {
  const text = (value: number | null | undefined) => (value ? String(value) : "");
  return {
    manualDailyPrice: text(list?.manualDailyPrice),
    minDailyPrice: text(list?.minDailyPrice),
    weekendDailyPrice: text(list?.weekendDailyPrice),
    quartos: text(list?.quartos),
    camas: text(list?.camas),
    banheiros: text(list?.banheiros),
    hospedes: text(list?.hospedes),
    propertyType: list?.propertyType ?? "",
  };
}
