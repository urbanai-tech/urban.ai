"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Stack,
  Text,
  HStack,
  IconButton,
  useToast,
  Badge,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon } from "@chakra-ui/icons";
import {
  signupWaitlist,
  fetchWaitlistStatus,
  type WaitlistSignupResult,
} from "../service/api";

const STORAGE_KEY = "urban-ai-waitlist-code-v1";

/**
 * Tela de pré-lançamento: form de inscrição + tela de "você é o #N na fila"
 * com referral.
 *
 * Fluxo:
 *  1. Renderiza form (email + nome + opcional phone)
 *  2. POST /waitlist → recebe { position, referralCode, aheadOfYou }
 *  3. Persiste referralCode em localStorage e troca para tela de status
 *  4. Tela de status mostra posição, total na fila, links de share que
 *     incluem ?ref=<code> para premiar quem indica
 *
 * Se o usuário já tem `referralCode` no localStorage, a tela inicial é
 * direto a de status (consultando o backend pra mostrar posição atual).
 */
export function WaitlistSignup({
  source = "create-signup",
  defaultEmail = "",
  defaultName = "",
}: {
  source?: string;
  defaultEmail?: string;
  defaultName?: string;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<"form" | "loading-existing" | "status">("form");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<WaitlistSignupResult | null>(null);
  const [statusReferrals, setStatusReferrals] = useState<number>(0);

  // ?ref=<code> na URL é capturado e enviado no signup
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Pega ?ref= da URL (e limpa pra não poluir UX após signup)
    const url = new URL(window.location.href);
    const refParam = url.searchParams.get("ref");
    if (refParam) setReferredBy(refParam);

    // 2. Se já há referralCode salvo, vai direto pra status
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPhase("loading-existing");
      fetchWaitlistStatus(saved)
        .then((s) => {
          setResult({
            position: s.position,
            referralCode: saved,
            aheadOfYou: s.aheadOfYou,
            totalSignups: s.totalSignups,
          });
          setStatusReferrals(s.referralsCount);
          setPhase("status");
        })
        .catch(() => {
          // localStorage tinha código inválido — limpa e volta pro form
          window.localStorage.removeItem(STORAGE_KEY);
          setPhase("form");
        });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({
        title: "E-mail inválido",
        description: "Use um e-mail válido para continuar.",
        status: "error",
        duration: 4000,
      });
      return;
    }

    setSubmitting(true);
    try {
      const r = await signupWaitlist({
        email: trimmedEmail,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        source,
        referredBy: referredBy ?? undefined,
      });
      setResult(r);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, r.referralCode);
      }
      setPhase("status");

      // Telemetria
      if (typeof window !== "undefined") {
        const w = window as unknown as {
          gtag?: (...args: unknown[]) => void;
          fbq?: (...args: unknown[]) => void;
        };
        w.gtag?.("event", "sign_up", { method: "waitlist", source });
        w.fbq?.("track", "Lead", { content_name: source });
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Não foi possível registrar agora. Tente em instantes.";
      toast({
        title: "Erro ao registrar",
        description: typeof message === "string" ? message : "Erro inesperado.",
        status: "error",
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading-existing") {
    return (
      <Flex minH="60vh" align="center" justify="center">
        <Text color="gray.500">Carregando sua posição na fila…</Text>
      </Flex>
    );
  }

  if (phase === "status" && result) {
    return (
      <WaitlistStatusCard
        result={result}
        referralsCount={statusReferrals}
        onReset={() => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
          }
          setResult(null);
          setPhase("form");
        }}
      />
    );
  }

  // Form
  return (
    <Box maxW="md" w="full" bg="white" p={{ base: 6, md: 8 }} borderRadius="2xl" boxShadow="lg">
      <Badge colorScheme="orange" mb={3} px={2} py={1} borderRadius="md" fontSize="xs">
        Pré-lançamento — acesso por convite
      </Badge>
      <Heading size="lg" mb={2} color="gray.800">
        Garanta seu lugar antes da abertura
      </Heading>
      <Text color="gray.600" mb={6}>
        A Urban AI está em pré-lançamento. Cadastre-se na lista de espera e
        avisamos por e-mail assim que liberarmos seu acesso.
      </Text>

      {referredBy && (
        <Alert status="success" variant="subtle" borderRadius="md" mb={4} fontSize="sm">
          <AlertIcon />
          <AlertDescription>
            Você foi indicado por alguém — bem-vindo(a)!
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Box>
            <Text fontSize="sm" mb={1} color="gray.700" fontWeight="medium">
              E-mail *
            </Text>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              isDisabled={submitting}
            />
          </Box>

          <Box>
            <Text fontSize="sm" mb={1} color="gray.700" fontWeight="medium">
              Como podemos te chamar?
            </Text>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              isDisabled={submitting}
            />
          </Box>

          <Box>
            <Text fontSize="sm" mb={1} color="gray.700" fontWeight="medium">
              WhatsApp (opcional)
            </Text>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              isDisabled={submitting}
            />
            <Text fontSize="xs" color="gray.500" mt={1}>
              Para chamar você primeiro caso libere acesso prioritário.
            </Text>
          </Box>

          <Button
            type="submit"
            colorScheme="blue"
            size="lg"
            isLoading={submitting}
            loadingText="Reservando…"
            mt={2}
          >
            Entrar na lista
          </Button>

          <Text fontSize="xs" color="gray.500" textAlign="center">
            Já tem convite?{" "}
            <a href="/" style={{ color: "#2563eb", textDecoration: "underline" }}>
              Faça login
            </a>
          </Text>
        </Stack>
      </form>
    </Box>
  );
}

function WaitlistStatusCard({
  result,
  referralsCount,
  onReset,
}: {
  result: WaitlistSignupResult;
  referralsCount: number;
  onReset: () => void;
}) {
  const toast = useToast();

  const referralUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = `${window.location.origin}/lancamento`;
    return `${base}?ref=${result.referralCode}`;
  }, [result.referralCode]);

  const shareText = `Acabei de garantir meu acesso antecipado à Urban AI — IA que precifica seu Airbnb cruzando eventos e dados de mercado. Entra você também:`;

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      toast({
        title: "Link copiado!",
        description: "Compartilhe pra subir na fila.",
        status: "success",
        duration: 2500,
      });
    });
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`;
    window.open(url, "_blank");
  }

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText,
    )}&url=${encodeURIComponent(referralUrl)}`;
    window.open(url, "_blank");
  }

  function shareLinkedIn() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      referralUrl,
    )}`;
    window.open(url, "_blank");
  }

  return (
    <Box maxW="lg" w="full" bg="white" p={{ base: 6, md: 8 }} borderRadius="2xl" boxShadow="lg" textAlign="center">
      <Box mx="auto" mb={4}>
        <CheckCircleIcon boxSize={14} color="green.500" />
      </Box>

      <Heading size="lg" mb={2} color="gray.800">
        Você está dentro!
      </Heading>
      <Text color="gray.600" mb={6}>
        Avisamos por e-mail assim que liberarmos seu acesso à plataforma.
      </Text>

      {/* Posição em destaque */}
      <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="xl" p={6} mb={6}>
        <Text fontSize="sm" color="blue.700" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Sua posição na fila
        </Text>
        <Heading size="3xl" color="blue.700" my={2}>
          #{result.position}
        </Heading>
        <Text fontSize="sm" color="blue.600">
          {result.aheadOfYou === 0
            ? "Você é o primeiro!"
            : `${result.aheadOfYou.toLocaleString("pt-BR")} ${result.aheadOfYou === 1 ? "pessoa" : "pessoas"} na sua frente`}
          {" · "}
          {result.totalSignups.toLocaleString("pt-BR")} no total
        </Text>
      </Box>

      {/* Indique amigos */}
      <Box textAlign="left" bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="xl" p={5} mb={6}>
        <HStack mb={2}>
          <Heading size="sm" color="orange.700">
            Quer subir na fila?
          </Heading>
          <Badge colorScheme="orange">+1 vaga por indicação</Badge>
        </HStack>
        <Text fontSize="sm" color="orange.800" mb={3}>
          Compartilhe seu link único. Cada pessoa que entrar pelo seu link sobe
          uma posição pra você.
        </Text>

        <HStack mb={3}>
          <Box flex="1" bg="white" borderWidth="1px" borderColor="orange.300" borderRadius="md" px={3} py={2} fontSize="sm" fontFamily="mono" color="gray.700" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {referralUrl}
          </Box>
          <IconButton
            aria-label="Copiar link"
            icon={<CopyIcon />}
            onClick={copyLink}
            colorScheme="orange"
            variant="outline"
            size="sm"
          />
        </HStack>

        <HStack spacing={2}>
          <Button size="sm" colorScheme="green" onClick={shareWhatsApp} flex="1">
            WhatsApp
          </Button>
          <Button size="sm" colorScheme="twitter" onClick={shareTwitter} flex="1">
            X / Twitter
          </Button>
          <Button size="sm" colorScheme="linkedin" onClick={shareLinkedIn} flex="1">
            LinkedIn
          </Button>
        </HStack>

        <Text fontSize="xs" color="orange.600" mt={3}>
          Indicações até agora: <strong>{referralsCount}</strong>
        </Text>
      </Box>

      <Text fontSize="xs" color="gray.500">
        Quer cadastrar outro e-mail?{" "}
        <Button variant="link" size="xs" colorScheme="blue" onClick={onReset}>
          começar de novo
        </Button>
      </Text>
    </Box>
  );
}
