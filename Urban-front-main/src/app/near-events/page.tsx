'use client';

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CasaCard from "../componentes/CasaCard";
import { Pagination } from "../componentes/Pagination";
import { AppEmptyState, AppPageShell, AppSectionHeader, Icons } from "../componentes/ui";
import { getUserProperties } from "../service/api";

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

export default function CasaEventosProximosPage() {
  const [houses, setHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const limite = 10;

  const fetchHouses = useCallback(async (pagina = 1) => {
    try {
      setLoading(true);
      const data = await getUserProperties(pagina, limite);
      if ((data.total ?? 0) === 0) {
        router.push("/onboarding");
        return;
      }

      setHouses(data.data ?? []);
      setTotalPaginas(Math.ceil((data.total ?? 0) / limite));
    } catch (err) {
      console.error("Erro ao buscar propriedades:", err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHouses(paginaAtual);
  }, [fetchHouses, paginaAtual]);

  if (loading) {
    return (
      <AppPageShell>
        <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1180}>
      <AppSectionHeader
        eyebrow="EVENTOS PRÓXIMOS"
        title="Eventos próximos aos seus imóveis"
        subtitle="Selecione um imóvel para ver os eventos detectados nas redondezas."
      />

      {houses.length === 0 ? (
        <AppEmptyState
          eyebrow="SEM IMÓVEIS"
          title="Nenhum imóvel encontrado"
          body="Cadastre um imóvel para acompanhar eventos próximos e oportunidades de precificação."
          icon={<Icons.MapPin size={32} />}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {houses.map((casa) => (
            <CasaCard
              key={casa.id}
              casa={casa}
              onClick={() => router.push('/near-events/' + casa.id)}
            />
          ))}
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
        animation: "near-events-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes near-events-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
