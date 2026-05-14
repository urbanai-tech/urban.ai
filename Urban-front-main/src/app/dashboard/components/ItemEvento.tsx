import { alterarAceitoSugestao, registrarPrecoAplicadoSugestao } from "@/app/service/api";
import { CloseIcon } from "@chakra-ui/icons";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Select,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { format, parseISO } from "date-fns";
import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from 'react-toastify';
    

export interface EventItem {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  enderecoCompleto?: string;
  cidade: string;
  estado: string;
  precoSugerido: string | number;
  seuPrecoAtual?: string | number;
  diferencaPercentual: string;
  recomendacao?: string;
  motivo_ia?: string | null;
  criadoEm?: string;
  precoAplicado?: string | number | null;
  aplicadoEm?: string | null;
  origemAplicacao?: string | null;
  reservaStatus?: "unknown" | "booked" | "not_booked" | "blocked" | null;
  receitaReal?: string | number | null;
  noitesReservadas?: string | number | null;
  resultadoRegistradoEm?: string | null;
  feedbackObservacao?: string | null;
  status?: "suggested" | "accepted" | "rejected" | "applied_manual" | "applied_stays" | "expired";
  aceitoEm?: string | null;
  rejeitadoEm?: string | null;
  expiradoEm?: string | null;
  idAnalise: string;
  aceito: boolean;
}

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

export const EventCard: React.FC<EventCardProps> = ({
  ev,
  cardBorder,
  bg,
  propertyId: _propertyId,
  setIsLoading,
  onChange,
}) => {
  const startDate = parseISO(ev.dataInicio);
  const diff = Number(ev.diferencaPercentual);
  const showPositiveDiff = Number.isFinite(diff) && diff > 0;
  const [loadingSaving, setLoadingSaving] = useState(false);
  const [loadingAppliedPrice, setLoadingAppliedPrice] = useState(false);

  const sugNum = toNumber(ev.precoSugerido);
  const atualNum = toNumber(ev.seuPrecoAtual);

  const [accepted, setAccepted] = useState(ev.aceito);
  const [appliedPriceInput, setAppliedPriceInput] = useState(
    ev.precoAplicado ? String(ev.precoAplicado).replace(".", ",") : "",
  );
  const [reservationStatus, setReservationStatus] = useState<EventItem["reservaStatus"]>(
    ev.reservaStatus || "unknown",
  );
  const [realRevenueInput, setRealRevenueInput] = useState(
    ev.receitaReal ? String(ev.receitaReal).replace(".", ",") : "",
  );
  const [bookedNightsInput, setBookedNightsInput] = useState(
    ev.noitesReservadas ? String(ev.noitesReservadas) : "",
  );
  const [feedbackNote, setFeedbackNote] = useState(ev.feedbackObservacao || "");

  useEffect(() => {
    setAccepted(ev.aceito);
    setAppliedPriceInput(ev.precoAplicado ? String(ev.precoAplicado).replace(".", ",") : "");
    setReservationStatus(ev.reservaStatus || "unknown");
    setRealRevenueInput(ev.receitaReal ? String(ev.receitaReal).replace(".", ",") : "");
    setBookedNightsInput(ev.noitesReservadas ? String(ev.noitesReservadas) : "");
    setFeedbackNote(ev.feedbackObservacao || "");
  }, [ev.aceito, ev.precoAplicado, ev.reservaStatus, ev.receitaReal, ev.noitesReservadas, ev.feedbackObservacao]);

  const handleAccept = async () => {
    setLoadingSaving(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, true);

      const updated = { ...ev, aceito: true, status: "accepted" as const };
      setAccepted(true);
      onChange?.(updated);



                   toast(`Você aceitou a sugestão de preço de ${formatBRL(sugNum)}`, { type: "success" });
      setLoadingSaving(false);
    } catch {
       toast("Não foi possível aceitar a sugestão de preço", { type: "error" });
      setLoadingSaving(false);
    } finally {
      setIsLoading(false);
      setLoadingSaving(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    setLoadingSaving(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, false);

      const updated = { ...ev, aceito: false, status: "rejected" as const };
      setAccepted(false);
      onChange?.(updated);
               toast("A sugestão de preço foi cancelada.", { type: "info" });
      setLoadingSaving(false);
    } catch {
       toast("Não foi possível cancelar a sugestão de preço.", { type: "error" });
      setLoadingSaving(false);
    } finally {
      setLoadingSaving(false);
      setIsLoading(false);
    }
  };

  const handleRegisterAppliedPrice = async () => {
    const appliedPrice = toNumber(appliedPriceInput);
    if (!Number.isFinite(appliedPrice) || appliedPrice <= 0) {
      toast("Informe um preço aplicado válido.", { type: "warning" });
      return;
    }

    setLoadingAppliedPrice(true);
    try {
      const receitaReal = realRevenueInput ? toNumber(realRevenueInput) : null;
      const noitesReservadas = bookedNightsInput ? Number(bookedNightsInput) : null;
      const normalizedNights = Number.isFinite(noitesReservadas as number)
        ? Math.max(0, Math.floor(noitesReservadas as number))
        : null;
      const normalizedRevenue = Number.isFinite(receitaReal as number) ? receitaReal : null;

      await registrarPrecoAplicadoSugestao(ev.idAnalise, appliedPrice, "manual_dashboard", {
        reservaStatus: reservationStatus,
        receitaReal: normalizedRevenue,
        noitesReservadas: normalizedNights,
        feedbackObservacao: feedbackNote || null,
      });
      onChange?.({
        ...ev,
        precoAplicado: appliedPrice,
        aplicadoEm: new Date().toISOString(),
        origemAplicacao: "manual_dashboard",
        reservaStatus: reservationStatus,
        receitaReal: normalizedRevenue,
        noitesReservadas: normalizedNights,
        resultadoRegistradoEm: new Date().toISOString(),
        feedbackObservacao: feedbackNote || null,
        status: "applied_manual",
      });
      toast("Preco e resultado registrados.", { type: "success" });
    } catch {
      toast("Não foi possível registrar o preço aplicado.", { type: "error" });
    } finally {
      setLoadingAppliedPrice(false);
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
      _hover={{ boxShadow: "md" }}
      transition="box-shadow 0.15s ease"
      w="100%"
    >
      <Flex direction="column" gap={3}>
        <Text fontWeight="extrabold" fontSize="xl" lineHeight="short">
          {ev.nome}
        </Text>

        <Flex gap={3} wrap="wrap" align="center">
          {/* Preço sugerido */}

      
          <Pill bgColor="#1931CF" ariaLabel="Preço sugerido">
            SUG. {formatBRL(sugNum)}
          </Pill>


          {/* Preço atual */}
          {ev.seuPrecoAtual && (
            <Pill bgColor="#3FCF19" ariaLabel="Preço atual">
              ATUAL {formatBRL(atualNum)}
              <Box
                as="span"
                ml={1}
                textTransform="none"
                fontSize="xs"
                opacity={0.9}
                whiteSpace="nowrap"
              >
                /diária
              </Box>
            </Pill>
          )}

          {/* Diferença percentual */}
          {showPositiveDiff ? (
            <Pill bgColor="#3FCF19" ariaLabel="Diferença positiva">
              +{diff.toFixed(2)}%
            </Pill>
          ) : (
            <Pill bgColor="#cf2519ff" ariaLabel="Diferença negativa">
              {diff.toFixed(2)}%
            </Pill>
          )}
        </Flex>

        <Text color="gray.600" fontSize="lg" fontWeight="semibold">
          {format(startDate, "dd/MM/yyyy")}
        </Text>

        <Text fontSize="md" color="gray.700">
          {ev.enderecoCompleto
            ? ev.enderecoCompleto
            : `${ev.cidade}, ${ev.estado}`}
        </Text>

        {(ev.motivo_ia || ev.recomendacao) && (
          <Box bg="gray.50" border="1px solid" borderColor="gray.200" borderRadius="lg" p={3}>
            <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase">
              Por que sugerimos
            </Text>
            <Text fontSize="sm" color="gray.700" mt={1}>
              {ev.motivo_ia || ev.recomendacao}
            </Text>
          </Box>
        )}

        {ev.precoAplicado && (
          <Pill bgColor="#1A7F64" ariaLabel="Preço aplicado registrado">
            APLICADO {formatBRL(ev.precoAplicado)}
          </Pill>
        )}

        {ev.status === "rejected" && (
          <Badge alignSelf="flex-start" colorScheme="red" borderRadius="full" px={3} py={1}>
            Rejeitada
          </Badge>
        )}

        {ev.status === "expired" && (
          <Badge alignSelf="flex-start" colorScheme="gray" borderRadius="full" px={3} py={1}>
            Expirada
          </Badge>
        )}

        <HStack spacing={3} mt={4}>
          {!accepted ? (
            <Button
              colorScheme="teal"
              isLoading={loadingSaving}
              size="md"
              fontWeight="bold"
              borderRadius="xl"
              boxShadow="sm"
              _hover={{ boxShadow: "md", transform: "scale(1.02)" }}
              onClick={handleAccept}
            >
              Aceitar Sugestão
            </Button>
          ) : (
            <Button
              colorScheme="red"
              size="md"
              isLoading={loadingSaving}
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

        {accepted && (
          <Flex gap={2} align={{ base: "stretch", sm: "center" }} direction={{ base: "column", md: "row" }} wrap="wrap">
            <Input
              value={appliedPriceInput}
              onChange={(event) => setAppliedPriceInput(event.target.value)}
              placeholder="Preço aplicado"
              inputMode="decimal"
              maxW={{ base: "100%", sm: "180px" }}
            />
            <Select
              value={reservationStatus || "unknown"}
              onChange={(event) =>
                setReservationStatus((event.target.value as EventItem["reservaStatus"]) || "unknown")
              }
              maxW={{ base: "100%", sm: "180px" }}
            >
              <option value="unknown">Resultado</option>
              <option value="booked">Reservou</option>
              <option value="not_booked">Nao reservou</option>
              <option value="blocked">Bloqueado</option>
            </Select>
            <Input
              value={realRevenueInput}
              onChange={(event) => setRealRevenueInput(event.target.value)}
              placeholder="Receita real"
              inputMode="decimal"
              maxW={{ base: "100%", sm: "150px" }}
            />
            <Input
              value={bookedNightsInput}
              onChange={(event) => setBookedNightsInput(event.target.value)}
              placeholder="Noites"
              inputMode="numeric"
              maxW={{ base: "100%", sm: "110px" }}
            />
            <Button
              onClick={handleRegisterAppliedPrice}
              isLoading={loadingAppliedPrice}
              colorScheme="blue"
              variant="outline"
            >
              Registrar preço aplicado
            </Button>
          </Flex>
        )}
        {accepted && (
          <Textarea
            value={feedbackNote}
            onChange={(event) => setFeedbackNote(event.target.value)}
            placeholder="Observacao opcional sobre a reserva"
            size="sm"
            resize="vertical"
          />
        )}
      </Flex>
    </Box>
  );
};
