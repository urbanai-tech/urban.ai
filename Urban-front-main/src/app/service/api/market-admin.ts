import { api } from "./client";

// ================== Fontes de mercado (ADR 0028) ==================
// GET  /admin/market/health
// POST /admin/market/licensed-dataset/import (multipart)
// Contrato em urban-ai-backend-main/src/market-data/market-health.service.ts e admin-market.controller.ts

export type MarketAdminSourceId = "customers" | "licensed_dataset" | "inside_airbnb" | "own_scraping";
export type MarketUploadLicense = "cc_by_4" | "licensed_display_aggregate" | "licensed_internal_only";

export interface MarketHealthSource {
  id: MarketAdminSourceId;
  label: string;
  enabled: boolean;
  /** Por que está desligada (ex.: "aguardando parecer jurídico"). */
  reason?: string;
  listings: number;
  lastCollectedAt: string | null;
  stale: boolean;
}

export interface MarketHealthNeighborhood {
  source: MarketAdminSourceId;
  city: string;
  neighborhood: string | null;
  listings: number;
  /** Só clientes: anfitriões distintos. */
  hosts?: number;
  lastCollectedAt: string | null;
}

export interface MarketHealthImport {
  id: string;
  source: string;
  city: string;
  license: string;
  collectedAt: string | null;
  fileName: string | null;
  rowsImported: number;
  rowsSkipped: number;
  observationsImported: number;
  createdAt: string;
}

export interface MarketHealthReport {
  generatedAt: string;
  config: { minHosts: number; minExternalListings: number; externalMaxAgeDays: number; scrapingEnabled: boolean };
  sources: MarketHealthSource[];
  neighborhoods: MarketHealthNeighborhood[];
  recentImports: MarketHealthImport[];
  coverage: {
    activeProperties: number;
    sampled: number;
    withSufficientCompSet: number;
    /** 0–1 sobre a amostra; null quando não há imóvel com coordenadas. */
    ratio: number | null;
    target: number;
    contributions: Partial<Record<MarketAdminSourceId, number>>;
    cachedAt: string;
  };
}

export interface LicensedDatasetImportInput {
  file: File;
  datasetLabel: string;
  city: string;
  license: MarketUploadLicense;
  /** YYYY-MM-DD */
  collectedAt: string;
  /** JSON { campo: "coluna" } (opcional). */
  mapping?: string;
}

export interface LicensedDatasetImportResult {
  batchId: string;
  source: string;
  parsed: number;
  imported: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  observations: number;
  collectedAt: string;
  warnings: string[];
}

export const fetchMarketHealth = () =>
  api.get<MarketHealthReport>("/admin/market/health").then((r) => r.data);

export const importLicensedDataset = (input: LicensedDatasetImportInput) => {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("datasetLabel", input.datasetLabel);
  fd.append("city", input.city);
  fd.append("license", input.license);
  fd.append("collectedAt", input.collectedAt);
  if (input.mapping?.trim()) fd.append("mapping", input.mapping.trim());
  return api
    .post<LicensedDatasetImportResult>("/admin/market/licensed-dataset/import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};
