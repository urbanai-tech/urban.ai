"use client";

import { useEffect, useState } from "react";
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
  validateWaitlistInvite,
  type WaitlistInviteValidation,
} from "../../service/api";

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
export default function AceitarConvite() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [validation, setValidation] = useState<WaitlistInviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setValidation({ valid: false, reason: "Link sem token" });
      setLoading(false);
      return;
    }
    validateWaitlistInvite(token)
      .then((v) => setValidation(v))
      .catch(() => setValidation({ valid: false, reason: "Erro ao validar convite" }))
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch || !validation) return;
    // O endpoint definitivo de "aceitar convite + criar User" é responsabilidade
    // do backend (vai num PR seguinte de F8.4). Por hora, este form prepara
    // a UI; submit redireciona pra home com email pré-preenchido pra usuário
    // saber que precisa terminar o cadastro lá.
    router.push(`/?email=${encodeURIComponent(validation.email ?? "")}`);
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
              isDisabled={!passwordsMatch}
              mt={2}
            >
              Ativar minha conta
            </Button>
          </Stack>
        </form>
      </Box>
    </Container>
  );
}
