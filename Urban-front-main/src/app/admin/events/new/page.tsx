"use client";

import { useState } from "react";
import {
  createManualEvent,
  fetchGeocoderStatus,
  runGeocoderNow,
  type ManualEventInput,
} from "../../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminBadge,
  useAdminToast,
  Icons,
} from "../../_components";

/**
 * /admin/events/new — Camada 3 (F6.2 Plus): cadastro manual de eventos.
 *
 * Migrado para design system admin (.urban-admin):
 *  - AdminSectionHeader com eyebrow.
 *  - Inputs/Selects/Textarea padronizados.
 *  - Resultado vira AdminCard variant accent com Badge de status.
 *  - alert()/erros nativos → toast.
 *  - CTA "Salvar" como AdminButton primary com loading.
 */

const VENUE_TYPES = [
  { value: "", label: "(automático via venue_map)" },
  { value: "stadium", label: "Estádio" },
  { value: "arena", label: "Arena/Casa de show" },
  { value: "convention_center", label: "Centro de convenções" },
  { value: "theater", label: "Teatro" },
  { value: "park", label: "Parque/outdoor" },
  { value: "other", label: "Outro" },
];

const CATEGORIAS = [
  "",
  "show",
  "esporte",
  "conferencia",
  "feira",
  "festival",
  "teatro",
  "cinema",
  "exposicao",
  "curso",
  "religioso",
  "outro",
];

type ResultStatus = "created" | "updated" | "skipped";

export default function NovoEventoManual() {
  const [form, setForm] = useState<ManualEventInput>({
    nome: "",
    dataInicio: "",
    cidade: "São Paulo",
    estado: "SP",
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    status: ResultStatus;
    reason?: string;
    id?: string;
    dedupHash?: string;
  } | null>(null);
  const [geocoderQueue, setGeocoderQueue] = useState<number | null>(null);
  const toast = useAdminToast();

  function patch<K extends keyof ManualEventInput>(
    key: K,
    value: ManualEventInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const r = await createManualEvent({
        ...form,
        latitude:
          form.latitude !== undefined &&
          form.latitude !== null &&
          !Number.isNaN(Number(form.latitude))
            ? Number(form.latitude)
            : undefined,
        longitude:
          form.longitude !== undefined &&
          form.longitude !== null &&
          !Number.isNaN(Number(form.longitude))
            ? Number(form.longitude)
            : undefined,
        venueCapacity: form.venueCapacity
          ? Number(form.venueCapacity)
          : undefined,
        expectedAttendance: form.expectedAttendance
          ? Number(form.expectedAttendance)
          : undefined,
      });
      const first = r.results[0] ?? null;
      setLastResult(first);
      if (first) {
        if (first.status === "created") toast.success("Evento cadastrado.");
        else if (first.status === "updated") toast.info("Evento atualizado.");
        else toast.warn(`Skipado: ${first.reason ?? "duplicado"}.`);
      }
      try {
        const g = await fetchGeocoderStatus();
        setGeocoderQueue(g.pendingGeocode);
      } catch {}
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Erro ao cadastrar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm({ nome: "", dataInicio: "", cidade: "São Paulo", estado: "SP" });
    setLastResult(null);
  }

  async function triggerGeocoder() {
    try {
      const r = await runGeocoderNow(50);
      toast.success(
        `Geocoder: tentou ${r.attempted}, sucesso ${r.succeeded}, falhou ${r.failed}.`,
      );
      const g = await fetchGeocoderStatus();
      setGeocoderQueue(g.pendingGeocode);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    }
  }

  const resultBadgeKind: Record<ResultStatus, "success" | "warn" | "error"> = {
    created: "success",
    updated: "warn",
    skipped: "error",
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · EVENTOS"
        title="Novo evento manual"
        subtitle={
          <>
            Camada 3 — curadoria humana. Source: <code>admin-manual</code>.
            Lat/lng opcional (backend geocodifica via cron quando ausente).
          </>
        }
        actions={
          <AdminButton
            variant="secondary"
            as="a"
            href="/admin/events/import"
            rightIcon={<Icons.ArrowRight size={12} />}
          >
            Importar CSV
          </AdminButton>
        }
      />

      {/* Resultado */}
      {lastResult && (
        <AdminCard variant="accent" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <AdminBadge kind={resultBadgeKind[lastResult.status]}>
              {lastResult.status}
            </AdminBadge>
            {lastResult.id && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                }}
              >
                {lastResult.id}
              </span>
            )}
            {lastResult.reason && (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--admin-text-muted)",
                }}
              >
                — {lastResult.reason}
              </span>
            )}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={reset}
              leftIcon={<Icons.Plus size={12} />}
            >
              Cadastrar outro
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              as="a"
              href="/admin/events"
            >
              Ver todos
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="Identificação" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AdminInput
              label="Nome *"
              value={form.nome}
              onChange={(e) => patch("nome", e.target.value)}
              required
              maxLength={255}
              placeholder='Ex: "Web Summit Rio 2026"'
            />
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
            >
              <AdminInput
                label="Data início *"
                type="datetime-local"
                value={form.dataInicio}
                onChange={(e) => patch("dataInicio", e.target.value)}
                required
              />
              <AdminInput
                label="Data fim"
                type="datetime-local"
                value={form.dataFim ?? ""}
                onChange={(e) => patch("dataFim", e.target.value)}
                helper="Opcional"
              />
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Localização" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AdminInput
              label="Endereço completo (recomendado)"
              value={form.enderecoCompleto ?? ""}
              onChange={(e) => patch("enderecoCompleto", e.target.value)}
              placeholder='Ex: "Allianz Parque - Av. Francisco Matarazzo, 1705"'
              helper="Quando lat/lng abaixo estiver vazio, o backend usa o endereço pra geocodificar via cron (a cada 30 min)."
            />
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 14 }}
            >
              <AdminInput
                label="Cidade"
                value={form.cidade ?? ""}
                onChange={(e) => patch("cidade", e.target.value)}
              />
              <AdminInput
                label="UF"
                value={form.estado ?? ""}
                onChange={(e) =>
                  patch("estado", e.target.value.toUpperCase().slice(0, 2))
                }
                maxLength={2}
              />
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
            >
              <AdminInput
                label="Latitude"
                type="number"
                step="0.000001"
                value={form.latitude ?? ""}
                onChange={(e) =>
                  patch(
                    "latitude",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="-23.5275"
                helper="Opcional"
              />
              <AdminInput
                label="Longitude"
                type="number"
                step="0.000001"
                value={form.longitude ?? ""}
                onChange={(e) =>
                  patch(
                    "longitude",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="-46.6783"
                helper="Opcional"
              />
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Categoria e venue" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
              }}
            >
              <AdminSelect
                label="Categoria"
                value={form.categoria ?? ""}
                onChange={(e) => patch("categoria", e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c || "(sem categoria)"}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                label="Tipo do venue"
                value={form.venueType ?? ""}
                onChange={(e) => patch("venueType", e.target.value)}
              >
                {VENUE_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </AdminSelect>
              <AdminInput
                label="Capacidade do venue"
                type="number"
                value={form.venueCapacity ?? ""}
                onChange={(e) =>
                  patch(
                    "venueCapacity",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="Ex: 43000"
              />
            </div>
            <AdminInput
              label="Público esperado deste evento"
              type="number"
              value={form.expectedAttendance ?? ""}
              onChange={(e) =>
                patch(
                  "expectedAttendance",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="Ex: 38000 (pode ser menor que capacidade)"
            />
          </div>
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Conteúdo" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AdminInput
              label="Link do site oficial"
              type="url"
              value={form.linkSiteOficial ?? ""}
              onChange={(e) => patch("linkSiteOficial", e.target.value)}
              placeholder="https://..."
            />
            <AdminInput
              label="URL da imagem"
              type="url"
              value={form.imagemUrl ?? ""}
              onChange={(e) => patch("imagemUrl", e.target.value)}
              placeholder="https://..."
            />
            <AdminTextarea
              label="Descrição"
              rows={4}
              value={form.descricao ?? ""}
              onChange={(e) => patch("descricao", e.target.value)}
              placeholder="Resumo do evento — vai pro card no painel admin e ajuda a IA a inferir relevância."
            />
          </div>
        </AdminCard>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 8,
          }}
        >
          <AdminButton type="submit" variant="primary" size="lg" loading={submitting}>
            {submitting ? "Salvando…" : "Cadastrar evento"}
          </AdminButton>

          {geocoderQueue !== null && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "var(--admin-text-muted)",
              }}
            >
              <span>
                Fila geocoder:{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  {geocoderQueue}
                </strong>
              </span>
              <AdminButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={triggerGeocoder}
                leftIcon={<Icons.RefreshCw size={11} />}
              >
                Rodar agora
              </AdminButton>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
