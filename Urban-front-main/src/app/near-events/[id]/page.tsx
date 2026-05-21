'use client';

import CasaCard from "@/app/componentes/CasaCard";
import { Pagination } from "@/app/componentes/Pagination";
import { AppCard, AppEmptyState, AppPageShell, AppSectionHeader, Icons } from "@/app/componentes/ui";
import { getEventos, getPropertyById } from "@/app/service/api";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';

export type Evento = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  cidade: string;
  estado: string;
  enderecoCompleto: string;
  latitude: string;
  longitude: string;
  imagem_url: string;
  linkSiteOficial: string;
  dataInicio: string;
  dataFim: string;
  dataCrawl: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  distancia_metros: number;
};

function formatEventDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export default function CasaEventosProximosPage() {
  const { t } = useTranslation();
  const params = useParams();
  const enderecoId = params?.id as string;

  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [endereco, setEndereco] = useState<any>(null);
  const [, setLoadingPropriedade] = useState(true);

  const limitePorPagina = 12;

  useEffect(() => {
    if (!enderecoId) return;

    const fetchEndereco = async () => {
      setLoadingPropriedade(true);
      const data = await getPropertyById(enderecoId);
      setEndereco(data);
      console.log(data);
      setLoadingPropriedade(false);
    };

    fetchEndereco();
  }, [enderecoId]);

  const fetchEventos = useCallback(async (pagina = 1) => {
    if (!enderecoId) return;

    try {
      setLoading(true);
      const data = await getEventos(pagina, limitePorPagina, enderecoId);

      setEventos(data.data ?? []);
      setTotalPaginas(Math.ceil((data.total ?? 0) / limitePorPagina));
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [enderecoId]);

  useEffect(() => {
    fetchEventos(paginaAtual);
  }, [fetchEventos, paginaAtual]);

  const tituloEndereco = endereco
    ? endereco.list?.titulo || `${endereco.logradouro ?? ''}${endereco.numero ? ', ' + endereco.numero : ''}`.trim() || 'Imovel'
    : 'Imovel';

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="EVENTOS PROXIMOS - DETALHE"
        title={loading && !endereco ? 'Carregando...' : tituloEndereco}
        subtitle="Eventos identificados proximos ao imovel. A distancia e calculada em linha reta a partir das coordenadas cadastradas."
      />

      {endereco && (
        <div style={{ marginBottom: 32 }}>
          <CasaCard key={endereco.id} casa={endereco} />
        </div>
      )}

      {loading ? (
        <div style={{ minHeight: 260, display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      ) : eventos.length === 0 ? (
        <AppEmptyState
          eyebrow="SEM EVENTOS PROXIMOS"
          title="Nenhum evento encontrado"
          body="Nao localizamos eventos proximos a este imovel no momento. Novas oportunidades aparecem conforme o radar e atualizado."
          icon={<Icons.Calendar size={32} />}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {eventos.map((ev: Evento) => (
              <AppCard key={ev.id} variant="default" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={ev?.imagem_url}
                  alt={ev.enderecoCompleto}
                  style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: 16 }}>
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "var(--app-text)",
                      fontSize: 15,
                      lineHeight: 1.35,
                      fontWeight: 650,
                    }}
                  >
                    {ev.nome ?? ev.enderecoCompleto}
                  </p>
                  <MetaRow icon={<Icons.Calendar size={12} />}>
                    {formatEventDate(ev.dataInicio)}
                    {ev.dataFim && ev.dataFim !== ev.dataInicio && (
                      <> - ate {formatEventDate(ev.dataFim)}</>
                    )}
                  </MetaRow>
                  <MetaRow icon={<Icons.MapPin size={12} />}>
                    {ev.enderecoCompleto}
                  </MetaRow>
                  <p
                    style={{
                      margin: "12px 0 0",
                      color: "var(--app-accent)",
                      fontSize: 14,
                      fontWeight: 750,
                    }}
                  >
                    {(Number(ev.distancia_metros) / 1000).toFixed(1)} {t('casas_proximas.km')}
                  </p>
                </div>
              </AppCard>
            ))}
          </div>
          <Pagination
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            onPageChange={(nova) => setPaginaAtual(nova)}
          />
        </div>
      )}
    </AppPageShell>
  );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 4px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "var(--app-text-muted)",
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--app-text-muted)", flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </p>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Carregando"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "3px solid var(--app-accent-soft)",
        borderTopColor: "var(--app-accent)",
        animation: "near-events-detail-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes near-events-detail-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
