import { Box, Flex, Text, Badge, Button, HStack } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { format, parseISO } from "date-fns";
import React, { Dispatch, SetStateAction, useState } from "react";
import { alterarAceitoSugestao } from "@/app/service/api";
import { EventItem } from "@/app/dashboard/components/ItemEvento";
  import { ToastContainer, toast } from 'react-toastify';
      
      

interface EventCardProps {
    ev: EventItem;
    cardBorder: string;
    bg: string;
    propertyId: string;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    onChange?: (updated: EventItem) => void;
}

// Função utilitária para converter valor em número
const toNumber = (v: string | number | undefined): number => {
    if (v === undefined || v === null) return NaN;
    if (typeof v === "number") return v;
    const s = v.trim();
    if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
    return Number(s);
};

// Formata número em BRL
const formatBRL = (value: string | number | undefined): string => {
    if (value === undefined || value === null) return "";
    const n = typeof value === "string" ? toNumber(value) : value;
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    }).format(n as number);
};

// Subcomponente Pill
const Pill = ({
    bgColor,
    children,
    ariaLabel,
}: {
    bgColor: string;
    children: React.ReactNode;
    ariaLabel?: string;
}) => (
    <Badge
        aria-label={ariaLabel}
        color="white"
        bg={bgColor}
        fontSize="sm"
        fontWeight="bold"
        px={3}
        py={1}
        borderRadius="full"
        letterSpacing={0.4}
        textTransform="uppercase"
        boxShadow="sm"
        whiteSpace="nowrap"
    >
        {children}
    </Badge>
);

export const EventCard: React.FC<EventCardProps> = ({ ev, cardBorder, bg, propertyId, setIsLoading, onChange }) => {
    const startDate = parseISO(ev.dataInicio);
    const diff = Number(ev.diferencaPercentual);
    const showPositiveDiff = Number.isFinite(diff) && diff > 0;

    const sugNum = toNumber(ev.precoSugerido);
    const atualNum = toNumber(ev.seuPrecoAtual);

    const [accepted, setAccepted] = useState(ev.aceito);


    const handleAccept = async () => {
        try {
            setIsLoading(true);
            await alterarAceitoSugestao(ev.idAnalise, true);
            ev.aceito = true;
            setAccepted(true);
            onChange?.({ ...ev });
                         toast(`Você aceitou a sugestão de preço de ${formatBRL(sugNum)}`, { type: "success" });
        } catch (error) {
             toast("Não foi possível aceitar a sugestão de preço", { type: "error" });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        try {
            setIsLoading(true);
            await alterarAceitoSugestao(ev.idAnalise, false);
            ev.aceito = false;
            setAccepted(false);
            onChange?.({ ...ev });
       toast("A sugestão de preço foi cancelada.", { type: "info" });
        } catch (error) {
             toast("Não foi possível cancelar a sugestão de preço", { type: "error" });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="2xl"
            p={5}
            bg={bg}
            boxShadow="xs"
            _hover={{ boxShadow: 'md' }}
            transition="box-shadow 0.15s ease"
        >
            <Flex direction="column" gap={3}>
                <Text fontWeight="extrabold" fontSize="xl" lineHeight="short">{ev.nome}</Text>

                <Flex gap={2} wrap="wrap">
                    <Pill bgColor="#1931CF" ariaLabel="Preço sugerido">SUG. {formatBRL(sugNum)}</Pill>

                    {ev.seuPrecoAtual && (
                        <Pill bgColor="#3FCF19" ariaLabel="Preço atual por diária">
                            ATUAL {formatBRL(atualNum)}
                            <Box as="span" ml={1} textTransform="none" fontSize="xs" opacity={0.9} whiteSpace="nowrap">/diária</Box>
                        </Pill>
                    )}

                    {showPositiveDiff ? (
                        <Pill bgColor="#3FCF19" ariaLabel="Diferença positiva">+{diff.toFixed(2)}%</Pill>
                    ) : (
                        <Pill bgColor="#cf2519ff" ariaLabel="Diferença negativa">{diff.toFixed(2)}%</Pill>
                    )}
                </Flex>

                <Text color="gray.600" fontSize="lg" fontWeight="semibold">{format(startDate, 'dd/MM/yyyy')}</Text>
                <Text fontSize="md" color="gray.700">{ev.enderecoCompleto ? ev.enderecoCompleto : `${ev.cidade}, ${ev.estado}`}</Text>

                <HStack spacing={3} mt={4}>
                    {!accepted && (
                        <Button
                            colorScheme="teal"
                            size="md"
                            fontWeight="bold"
                            borderRadius="xl"
                            boxShadow="sm"
                            _hover={{ boxShadow: "md", transform: "scale(1.02)" }}
                            onClick={handleAccept}
                        >
                            Aceitar Sugestão
                        </Button>
                    )}

                    {accepted && (
                        <Button
                            colorScheme="red"
                            size="md"
                            fontWeight="bold"
                            borderRadius="xl"
                            boxShadow="sm"
                            _hover={{ boxShadow: "md", transform: "scale(1.02)" }}
                            onClick={handleCancel}
                            leftIcon={<CloseIcon />}
                        >
                            Cancelar
                        </Button>
                    )}
                </HStack>
            </Flex>
               <ToastContainer />
        </Box>
    );
};
