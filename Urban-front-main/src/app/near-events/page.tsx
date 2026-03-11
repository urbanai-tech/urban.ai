'use client';

import {
  Container,
  Flex,
  Heading,
  Spinner,
  VStack
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import CasaCard from "../componentes/CasaCard";
import { Pagination } from "../componentes/Pagination";
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
  dataInicio: string;     // ISO date string
  dataFim: string;        // ISO date string
  dataCrawl: string | null;
  ativo: boolean;
  createdAt: string;      // ISO date string
  updatedAt: string;      // ISO date string
  distancia_metros: number;
};



export default function CasaEventosProximosPage() {
  const { t } = useTranslation();
 // const userId = "fc93170a-1e58-4d5c-a615-b373859a84e0";
  const [houses, setHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const limite = 10;


  async function fetchHouses(pagina = 1) {
    try {
      setLoading(true);
      const data = await getUserProperties(pagina, limite);
      if ((data.total ?? 0) === 0) {
        router.push("/app");
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
  }


  useEffect(() => {
    fetchHouses(paginaAtual);
  }, [paginaAtual]);


  if (loading) {
    return (
      <Flex align="center" justify="center" minH="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Container maxW="100%" p={{ base: 4, md: 8 }} bg="gray.50">
      <VStack spacing={10}>
        <VStack w={"100%"} alignItems={"start"}>
          <Heading size="lg" textAlign={{ base: 'center', sm: 'left' }}>
            {t('my_properties.title')}
          </Heading>
        </VStack>

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

      </VStack>
    </Container>
  );
}
