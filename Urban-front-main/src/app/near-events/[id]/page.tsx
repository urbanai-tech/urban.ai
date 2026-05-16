'use client';

import CasaCard from "@/app/componentes/CasaCard";
import { Pagination } from "@/app/componentes/Pagination";
import { getEventos, getPropertyById } from "@/app/service/api";
import {
    Box,
    Center,
    Flex,
    Image,
    SimpleGrid,
    Spinner,
    Text,
    VStack
} from "@chakra-ui/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import {
    AppPageShell,
    AppSectionHeader,
    AppCard,
    AppEmptyState,
    Icons,
} from "@/app/componentes/ui";


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
    if (!value) return "—";
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
    const limitePorPagina = 12;
    const [endereco, setEndereco] = useState<any>(null);
    const [, setLoadingPropriedade] = useState(true);

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
        ? endereco.list?.titulo || `${endereco.logradouro ?? ''}${endereco.numero ? ', ' + endereco.numero : ''}`.trim() || 'Imóvel'
        : 'Imóvel';

    return (
        <AppPageShell maxWidth={1280}>
            <AppSectionHeader
                eyebrow="EVENTOS PRÓXIMOS · DETALHE"
                title={loading && !endereco ? 'Carregando…' : tituloEndereco}
                subtitle="Eventos identificados próximos ao imóvel. A distância é calculada em linha reta a partir das coordenadas cadastradas."
            />

            {endereco && (
                <Box mb={8}>
                    <CasaCard key={endereco.id} casa={endereco} />
                </Box>
            )}

            {loading ? (
                <Center py={20}>
                    <Spinner size="xl" color="orange.500" thickness="2px" />
                </Center>
            ) : eventos.length === 0 ? (
                <AppEmptyState
                    eyebrow="SEM EVENTOS PRÓXIMOS"
                    title="Nenhum evento encontrado"
                    body="Não localizamos eventos próximos a este imóvel no momento. Novas oportunidades aparecem conforme o radar é atualizado."
                    icon={<Icons.Calendar size={32} />}
                />
            ) : (
                <VStack spacing={8} align="stretch">
                    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 3 }} spacing={4}>
                        {eventos.map((ev: Evento) => (
                            <AppCard key={ev.id} variant="default" style={{ padding: 0, overflow: 'hidden' }}>
                                <Image
                                    src={ev?.imagem_url}
                                    alt={ev.enderecoCompleto}
                                    h="180px"
                                    w="100%"
                                    objectFit="cover"
                                />
                                <Box p={4}>
                                    <Text
                                        fontWeight={600}
                                        mb={2}
                                        noOfLines={2}
                                        style={{ color: 'var(--app-text)', fontSize: 15, lineHeight: 1.35 }}
                                    >
                                        {ev.nome ?? ev.enderecoCompleto}
                                    </Text>
                                    <Flex align="center" gap={1.5} mb={1}>
                                        <Box style={{ color: 'var(--app-text-muted)' }}>
                                            <Icons.Calendar size={12} />
                                        </Box>
                                        <Text fontSize="xs" style={{ color: 'var(--app-text-muted)' }}>
                                            {formatEventDate(ev.dataInicio)}
                                            {ev.dataFim && ev.dataFim !== ev.dataInicio && (
                                                <> · até {formatEventDate(ev.dataFim)}</>
                                            )}
                                        </Text>
                                    </Flex>
                                    <Flex align="center" gap={1.5} mb={3}>
                                        <Box style={{ color: 'var(--app-text-muted)' }}>
                                            <Icons.MapPin size={12} />
                                        </Box>
                                        <Text fontSize="xs" noOfLines={1} style={{ color: 'var(--app-text-muted)' }}>
                                            {ev.enderecoCompleto}
                                        </Text>
                                    </Flex>
                                    <Text
                                        fontSize="sm"
                                        fontWeight={700}
                                        style={{ color: 'var(--app-accent)' }}
                                    >
                                        {(Number(ev.distancia_metros) / 1000).toFixed(1)} {t('casas_proximas.km')}
                                    </Text>
                                </Box>
                            </AppCard>
                        ))}
                    </SimpleGrid>
                    <Pagination
                        paginaAtual={paginaAtual}
                        totalPaginas={totalPaginas}
                        onPageChange={(nova) => setPaginaAtual(nova)}
                    />
                </VStack>
            )}
        </AppPageShell>
    );
}
