"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import {
  acceptWaitlistInvite,
  validateWaitlistInvite,
  type WaitlistInviteValidation,
} from "../../service/api";
import { trackAnalyticsEvent } from "../../componentes/Analytics";

/**
 * Página de aceite de convite da waitlist (F8.4).
 *
 * Fluxo:
 *   /waitlist/aceitar?token=<token>
 *
 *   1. Valida token via GET /waitlist/invite
 *   2. Se OK: mostra form para criar senha (email já vem do backend)
 *   3. Submit chama POST /auth/register com flag de invite_token
 *   4. Backend reconhece, cria User real, marca waitlist como converted
 *   5. Redireciona para login com toast de sucesso
 */
export default function AceitarConvitePage() {
  // Next 15 exige Suspense boundary em volta de useSearchParams para evitar
  // bailout total do prerender estático.
  return (
    <Suspense
      fallback={
        <Container maxW="md" py={20} centerContent>
          <Spinner size="xl" color="blue.500" />
        </Container>
      }
    >
      <AceitarConvite />
    </Suspense>
  );
}

function AceitarConvite() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [validation, setValidation] = useState<WaitlistInviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setValidation({ valid: false, reason: "Link sem token" });
      setLoading(false);
      return;
    }
    validateWaitlistInvite(token)
      .then((v) => {
        setValidation(v);
        trackAnalyticsEvent(v.valid ? "waitlist_invite_valid" : "waitlist_invite_invalid", {
          reason: v.reason,
        });
      })
      .catch(() => {
        setValidation({ valid: false, reason: "Erro ao validar convite" });
        trackAnalyticsEvent("waitlist_invite_invalid", {
          reason: "validation_request_failed",
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <Container maxW="md" py={20} centerContent>
        <Spinner size="xl" color="blue.500" />
        <Text mt={4} color="gray.600">
          Validando seu convite…
        </Text>
      </Container>
    );
  }

  if (!validation?.valid) {
    return (
      <Container maxW="md" py={20}>
        <Alert status="error" borderRadius="md" flexDirection="column" alignItems="flex-start">
          <Box display="flex" mb={2}>
            <AlertIcon />
            <AlertTitle>Convite inválido</AlertTitle>
          </Box>
          <AlertDescription mb={4}>
            {validation?.reason ?? "Este link de convite está expirado ou já foi usado."}
          </AlertDescription>
          <Button onClick={() => router.push("/lancamento")} colorScheme="blue" size="sm">
            Voltar ao pré-lançamento
          </Button>
        </Alert>
      </Container>
    );
  }

  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch || !validation) return;
    setSubmitting(true);
    setSubmitError("");
    trackAnalyticsEvent("waitlist_invite_accept_attempt", {
      source: "waitlist-invite",
    });
    // O endpoint definitivo de "aceitar convite + criar User" é responsabilidade
    // a UI; submit redireciona pra home com email pré-preenchido pra usuário
    // saber que precisa terminar o cadastro lá.
    try {
      await acceptWaitlistInvite({
        token,
        username: validation.name ?? validation.email?.split("@")[0],
        password,
      });
      trackAnalyticsEvent("waitlist_invite_accept", {
        source: "waitlist-invite",
      });
      router.push("/dashboard");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Nao foi possivel ativar sua conta. Tente novamente ou fale com o suporte.";
      setSubmitError(message);
      trackAnalyticsEvent("waitlist_invite_accept_error", {
        reason: error?.response?.status ? `http_${error.response.status}` : error?.message || "unknown",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxW="md" py={16}>
      <Box bg="white" p={8} borderRadius="2xl" boxShadow="lg">
        <Heading size="lg" mb={2} color="gray.800">
          Olá, {validation.name?.split(" ")[0] ?? "bem-vindo(a)"}!
        </Heading>
        <Text color="gray.600" mb={6}>
          Você estava na <strong>posição #{validation.position}</strong> da nossa
          lista. Agora é só criar sua senha e começar a usar a Urban AI.
        </Text>

        <form onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <FormControl isReadOnly>
              <FormLabel>E-mail</FormLabel>
              <Input value={validation.email ?? ""} bg="gray.50" />
              <FormHelperText>Confirmado via convite, não pode ser alterado.</FormHelperText>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Crie sua senha</FormLabel>
              <Input
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Confirme a senha</FormLabel>
              <Input
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
              {confirmPassword && !passwordsMatch && (
                <FormHelperText color="red.500">As senhas não conferem.</FormHelperText>
              )}
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              isDisabled={!passwordsMatch || submitting}
              isLoading={submitting}
              mt={2}
            >
              Ativar minha conta
            </Button>

            {submitError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </Stack>
        </form>
      </Box>
    </Container>
  );
}
