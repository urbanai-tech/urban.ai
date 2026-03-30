'use client';

import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Text,
  VStack,
  InputGroup,
  InputRightElement,
  IconButton,
  List,
  ListItem,
  ListIcon,
  FormHelperText,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, CheckCircleIcon, CloseIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { updatePassword } from '@/app/service/api';
import { useToastCustom } from '@/hooks/useToastCustom';

const MotionBox = motion(Box);

const PasswordConfirmation = () => {
  const router = useRouter();
  const {  showToastCustom, ToastContainer } = useToastCustom();

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const params = useParams();
  const userId = params?.id as string; // capturado da rota

  async function sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const checks = useMemo(() => ({
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*]/.test(password),
    length: password.length >= 8,
    match: password.length > 0 && password === confirmPassword,
  }), [password, confirmPassword]);

  const satisfiedCount = useMemo(() =>
    Object.values(checks).filter(Boolean).length,
    [checks]
  );

  const strength = useMemo(() => {
    if (satisfiedCount <= 3) return 'Fraca';
    if (satisfiedCount <= 5) return 'Média';
    return 'Forte';
  }, [satisfiedCount]);

  const canSubmit = useMemo(() => (
    !loading &&
    Object.values(checks).every(Boolean)
  ), [checks, loading]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const hashedPassword = await sha256(password);
      const res = await updatePassword(userId, hashedPassword);

      if (!res.enviado) {
        throw new Error("Erro ao confirmar redefinição de senha");
      }
      showToastCustom("Sua senha foi redefinida com sucesso.", "success");


      setSuccess(true); // ativa tela de sucesso

    } catch (error: any) {
      console.error("Erro handleSubmit:", error.response?.data || error.message);
      showToastCustom(error.response?.data?.message || "Erro ao atualizar senha.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" w="100%" align="center" justify="center" bg="gray.50" p={4}>
      <MotionBox
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        w="100%"
        maxW="md"
        bg="white"
        borderRadius="xl"
        boxShadow="xl"
        p={8}
      >
        {!success ? (
          <VStack spacing={6} align="stretch">
            <Box textAlign="center">
              <Heading size="xl" mb={2} color="blue.600">
                Confirmação de Senha
              </Heading>
              <Text fontSize="lg" color="gray.600">
                Crie uma nova senha segura
              </Text>
            </Box>

            {/* Nova Senha */}
            <FormControl>
              <FormLabel fontWeight="semibold">Nova Senha</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  size="lg"
                  focusBorderColor="blue.500"
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>

            {/* Confirmar Senha */}
            <FormControl>
              <FormLabel fontWeight="semibold">Confirmar Senha</FormLabel>
              <InputGroup>
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  size="lg"
                  focusBorderColor="blue.500"
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
                    icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </InputRightElement>
              </InputGroup>

              {confirmPassword.length > 0 && (
                <FormHelperText color={checks.match ? "green.500" : "red.500"}>
                  {checks.match ? "As senhas coincidem" : "As senhas não coincidem"}
                </FormHelperText>
              )}
            </FormControl>

            {/* Painel de requisitos */}
            <Box borderWidth="1px" borderRadius="md" p={4} bg="gray.50">
              <Text fontWeight="bold" mb={2}>Requisitos de Segurança</Text>
              <List spacing={2}>
                <ListItem><ListIcon as={checks.lower ? CheckCircleIcon : CloseIcon} color={checks.lower ? "green.500" : "red.500"} />Letra minúscula</ListItem>
                <ListItem><ListIcon as={checks.upper ? CheckCircleIcon : CloseIcon} color={checks.upper ? "green.500" : "red.500"} />Letra maiúscula</ListItem>
                <ListItem><ListIcon as={checks.number ? CheckCircleIcon : CloseIcon} color={checks.number ? "green.500" : "red.500"} />Número</ListItem>
                <ListItem><ListIcon as={checks.special ? CheckCircleIcon : CloseIcon} color={checks.special ? "green.500" : "red.500"} />Caractere especial (!@#$%^&*)</ListItem>
                <ListItem><ListIcon as={checks.length ? CheckCircleIcon : CloseIcon} color={checks.length ? "green.500" : "red.500"} />Mínimo 8 caracteres</ListItem>
                <ListItem><ListIcon as={checks.match ? CheckCircleIcon : CloseIcon} color={checks.match ? "green.500" : "red.500"} />Senhas coincidem</ListItem>
              </List>

              <Box mt={3}>
                <Text display="inline-block" fontWeight="bold">Força da senha: </Text>
                <Text display="inline-block" fontWeight="bold"
                  color={strength === 'Fraca' ? 'red.500' : strength === 'Média' ? 'orange.500' : 'green.500'}>
                  {strength}
                </Text>
              </Box>
            </Box>

            <Button
              size="lg"
              bg="#1C1D3B"
              color="white"
              _hover={{ bg: "#262750" }}   // ~6% mais claro
              _active={{ bg: "#121326" }}
              isLoading={loading}
              loadingText="Atualizando..."
              isDisabled={!canSubmit}
              onClick={handleSubmit}
              transition="all 0.2s"
            >
              Confirmar Nova Senha
            </Button>

          </VStack>
        ) : (
          // Tela de sucesso
          <VStack spacing={6} align="center" textAlign="center">
            <Heading size="lg" color="green.500">
              🎉 Senha atualizada com sucesso!
            </Heading>
            <Text color="gray.600">
              Agora você já pode fazer login com sua nova senha.
            </Text>
            <Button colorScheme="blue" size="lg" onClick={() => router.push("/")}>
              Ir para Login
            </Button>
          </VStack>
        )}
      </MotionBox>
    </Flex>
  );
};

export default PasswordConfirmation;
