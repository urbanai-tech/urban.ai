"use client";

import { api } from "./api";

/** Categorias de aviso (push) que o anfitrião liga/desliga. Mapeiam para colunas de communication-preferences. */
export type PushCategoryKey = "pushPricing" | "pushEvents" | "weeklyReport";

export type PushCategoryPrefs = Record<PushCategoryKey, boolean>;

export const PUSH_CATEGORIES: ReadonlyArray<{ key: PushCategoryKey; label: string; description: string }> = [
  {
    key: "pushPricing",
    label: "Preço",
    description: "Quando houver recomendação de preço nova para revisar.",
  },
  {
    key: "pushEvents",
    label: "Eventos",
    description: "Quando um evento relevante mudar a demanda perto dos seus imóveis.",
  },
  {
    key: "weeklyReport",
    label: "Resumo semanal",
    description: "Uma vez por semana, com o que vem pela frente. Vale também para o e-mail do resumo.",
  },
];

type PreferencesResponse = Partial<Record<PushCategoryKey, boolean>>;

export function toPushCategoryPrefs(response: PreferencesResponse | null | undefined): PushCategoryPrefs {
  return {
    pushPricing: response?.pushPricing !== false,
    pushEvents: response?.pushEvents !== false,
    weeklyReport: response?.weeklyReport !== false,
  };
}

export async function fetchPushCategoryPrefs(): Promise<PushCategoryPrefs> {
  const { data } = await api.get<PreferencesResponse>("/communication-preferences/me");
  return toPushCategoryPrefs(data);
}

export async function updatePushCategoryPrefs(patch: Partial<PushCategoryPrefs>): Promise<PushCategoryPrefs> {
  const { data } = await api.put<PreferencesResponse>("/communication-preferences/me", patch);
  return toPushCategoryPrefs(data);
}
