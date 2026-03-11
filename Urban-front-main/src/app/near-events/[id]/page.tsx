'use client';

import CasaCard from "@/app/componentes/CasaCard";
import { Pagination } from "@/app/componentes/Pagination";
import { getEventos, getPropertyById } from "@/app/service/api";
import {
    Box,
    Container,
    Flex,
    Image,
    SimpleGrid,
    Spinner,
    Text,
    VStack
} from "@chakra-ui/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
    const params = useParams();
    const enderecoId = params?.id as string;

    const [eventos, setEventos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [paginaAtual, setPaginaAtual] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const limitePorPagina = 12;
  const [endereco, setEndereco] = useState<any>(null);
  const [, setLoadingPropriedade] = useState(true);

  useEffect(() => {
    if (!enderecoId) return;

    const fetchEndereco = async () => {
      setLoadingPropriedade(true);
      const data = await getPropertyById(enderecoId);
      setEndereco(data);
      console.log(data)
      setLoadingPropriedade(false);
    };

    fetchEndereco();
  }, [enderecoId]);

    async function fetchEventos(pagina = 1) {
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
    }
    useEffect(() => {
        // const data = await getUserProperties(userId, 1, 10, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YmQwYzYxYi0xMzA5LTRhNDMtOTk0Ni1kNGI1MmQ5ZGRiNTkiLCJ1c2VybmFtZSI6InRoaXNsdWNhc21lIiwiaWF0IjoxNzUzNzI0MjkzLCJleHAiOjE3NTM3Njc0OTN9.yVYe_XfHDIdwVVG0S99EQ80TggulhrzGR3jqoel3OsQ");
        fetchEventos(paginaAtual);
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
               <CasaCard
                 key={endereco.id}
                 casa={endereco}
                 /* onClick={() => router.push('/near-events/' + casa.id)} */
               />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 3 }} spacing={4}>
                    {eventos.map((ev: Evento) => (
                        <Box
                            key={`evento-${Math.random().toString(36).substr(2, 9)}`}

                            bg="white"
                            borderRadius="2xl"
                            boxShadow="sm"
                            overflow="hidden"
                        >
                            <Image
                                src={ev?.imagem_url}
                                alt={ev.enderecoCompleto}
                                h="180px"
                                w="100%"
                                objectFit="cover"
                            />
                            <Box p={4}>
                                <Text fontWeight="bold" mb={1} noOfLines={2}>
                                    {ev.enderecoCompleto}
                                </Text>
                                <Text fontSize="sm" color="gray.600" mb={1}>
                                    {ev.dataInicio}
                                </Text>
                                <Text fontSize="sm" color="gray.600" mb={2}>
                                    {ev.dataFim}
                                </Text>
                                <Text fontSize="sm" fontWeight="semibold" color="blue.500">
                                    {(Number(ev.distancia_metros) / 1000).toFixed(1)} {t('casas_proximas.km')}
                                </Text>
                            </Box>
                        </Box>
                    ))}
                </SimpleGrid>
                <Pagination
                    paginaAtual={paginaAtual}
                    totalPaginas={totalPaginas}
                    onPageChange={(nova) => setPaginaAtual(nova)}
              
                />
                );
            </VStack>
        </Container>
    );
}
