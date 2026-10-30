'use client';

import CasaCard from "@/app/componentes/CasaCard";
import { Pagination } from "@/app/componentes/Pagination";
import { AppCard, AppEmptyState, AppPageShell, AppSectionHeader, Icons } from "@/app/componentes/ui";
import { getEventos, getPropertyById } from "@/app/service/api";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import styles from "./page.module.css";

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
    ? endereco.list?.titulo || `${endereco.logradouro ?? ''}${endereco.numero ? ', ' + endereco.numero : ''}`.trim() || 'Imóvel'
    : 'Imóvel';

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="EVENTOS PRÓXIMOS - DETALHE"
        title={loading && !endereco ? 'Carregando…' : tituloEndereco}
        subtitle="Eventos identificados próximos ao imóvel. A distância é calculada em linha reta a partir das coordenadas cadastradas."
      />

      {endereco && (
        <div className={styles.propertyCardWrap}>
          <CasaCard key={endereco.id} casa={endereco} />
        </div>
      )}

      {loading ? (
        <div className={styles.loadingBox}>
          <Spinner />
        </div>
      ) : eventos.length === 0 ? (
        <AppEmptyState
          eyebrow="SEM EVENTOS PRÓXIMOS"
          title="Nenhum evento encontrado"
          body="Não localizamos eventos próximos a este imóvel no momento. Novas oportunidades aparecem conforme o radar e atualizado."
          icon={<Icons.Calendar size={32} />}
        />
      ) : (
        <div className={styles.eventsSection}>
          <div className={styles.eventGrid}>
            {eventos.map((ev: Evento) => (
              <AppCard key={ev.id} variant="default" className={styles.eventCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ev?.imagem_url}
                  alt={ev.enderecoCompleto}
                  className={styles.eventImage}
                />
                <div className={styles.eventBody}>
                  <p className={styles.eventTitle}>
                    {ev.nome ?? ev.enderecoCompleto}
                  </p>
                  <MetaRow icon={<Icons.Calendar size={12} />}>
                    {formatEventDate(ev.dataInicio)}
                    {ev.dataFim && ev.dataFim !== ev.dataInicio && (
                      <> - até {formatEventDate(ev.dataFim)}</>
                    )}
                  </MetaRow>
                  <MetaRow icon={<Icons.MapPin size={12} />}>
                    {ev.enderecoCompleto}
                  </MetaRow>
                  <p className={styles.eventDistance}>
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
    <p className={styles.metaRow}>
      <span className={styles.metaIcon}>
        {icon}
      </span>
      <span className={styles.metaText}>
        {children}
      </span>
    </p>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={styles.spinner}
    />
  );
}
