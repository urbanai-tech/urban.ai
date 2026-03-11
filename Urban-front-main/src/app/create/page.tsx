"use client";
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
  Image,
  Input,
  Link,
  Text,
  VStack,
  InputGroup,
  InputRightElement,
  InputLeftElement,
  IconButton,
  List,
  ListItem,
  ListIcon,
  FormHelperText,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  ViewIcon,
  ViewOffIcon,
  CheckCircleIcon,
  CloseIcon,
  EmailIcon,
  AtSignIcon,
} from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import "../../../i18n";
import { api } from "../service/api";
import SelectLanguageChakra from "../componentes/SelectLanguageChakra";
import { ToastContainer, toast } from "react-toastify";

const MotionBox = motion(Box);

// Função de hash
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const Register = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [failure, setFailure] = useState(false);

  const checks = useMemo(
    () => ({
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*]/.test(password),
      length: password.length >= 8,
    }),
    [password]
  );

  const match = useMemo(
    () => password.length > 0 && password === confirmPassword,
    [password, confirmPassword]
  );

  const satisfiedCount = useMemo(
    () => Object.values(checks).filter(Boolean).length,
    [checks]
  );

  const strength = useMemo(() => {
    if (satisfiedCount <= 2) return "Fraca";
    if (satisfiedCount <= 4) return "Média";
    return "Forte";
  }, [satisfiedCount]);

  const canSubmit = useMemo(() => {
    const allRulesOk = Object.values(checks).every(Boolean);
    return !loading && allRulesOk && match && !!email && !!username;
  }, [checks, match, email, username, loading]);

  const handleRegister = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      setFailure(false);

      const hashedPassword = await sha256(password);

      await api.post("/auth/register", {
        email,
        username,
        password: hashedPassword,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("lastRegisterEmail", email);
      }

      toast("Enviamos um e-mail para confirmar sua conta.", { type: "success" });

      router.push("/");
    } catch (err: any) {
      setFailure(true);
      setErrorMsg(err.response?.data?.message || err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      w="100%"
      flexDirection={{ base: "column", md: "row" }}
      overflow="hidden"
    >
      <Box display={{ base: "none", md: "block" }} w={{ md: "50%" }} h="100vh">
        <Image
          src="/urbanai_only.png"
          alt="Ilustração de cadastro"
          objectFit="cover"
          w="100%"
          h="100%"
        />
      </Box>

      <Flex
        w={{ base: "100%", md: "50%" }}
        minH="100vh"
        align="center"
        justify="center"
        bg="white"
        p={6}
        position="relative"
        overflowY="auto"
      >
        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          p={{ base: 0, md: 6 }}
          borderRadius={{ base: "none", md: "2xl" }}
          w="100%"
          maxW="md"
        >
          <VStack spacing={5} align="stretch">
            <VStack w="full">
              <Image alt="Urban AI" w={200} src="/urban-logo-transparent-soft.png" />
            </VStack>

            <Box textAlign="center">
              <Heading size="lg" mb={2}>
                Criar conta
              </Heading>
              <Text fontSize="md" color="gray.600">
                Preencha seus dados para começar.
              </Text>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel fontSize="md">Nome de usuário</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <AtSignIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    value={username}
                    onChange={(e) => setUserName(e.target.value)}
                    size="md"
                    placeholder="Seu usuário"
                    autoComplete="username"
                  />
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="md">E-mail</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <EmailIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    size="md"
                    type="email"
                    placeholder="Seu e-mail"
                    autoComplete="email"
                  />
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="md">Senha</FormLabel>
                <InputGroup size="md">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    autoComplete="new-password"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword((s) => !s)}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="md">Confirmar senha</FormLabel>
                <InputGroup size="md">
                  <Input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                    />
                  </InputRightElement>
                </InputGroup>
                {confirmPassword.length > 0 && (
                  <FormHelperText color={match ? "green.600" : "red.500"}>
                    {match ? "As senhas coincidem." : "As senhas não conferem."}
                  </FormHelperText>
                )}
              </FormControl>
            </SimpleGrid>

            <Box mt={2} p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
              <Text fontWeight="medium" mb={2}>
                Regras da senha
              </Text>
              <List spacing={1} fontSize="sm" aria-live="polite">
                <ListItem>
                  <ListIcon as={checks.lower ? CheckCircleIcon : CloseIcon} color={checks.lower ? "green.500" : "gray.400"} />
                  Pelo menos uma letra minúscula
                </ListItem>
                <ListItem>
                  <ListIcon as={checks.upper ? CheckCircleIcon : CloseIcon} color={checks.upper ? "green.500" : "gray.400"} />
                  Pelo menos uma letra maiúscula
                </ListItem>
                <ListItem>
                  <ListIcon as={checks.number ? CheckCircleIcon : CloseIcon} color={checks.number ? "green.500" : "gray.400"} />
                  Pelo menos um número
                </ListItem>
                <ListItem>
                  <ListIcon as={checks.special ? CheckCircleIcon : CloseIcon} color={checks.special ? "green.500" : "gray.400"} />
                  Pelo menos um caractere especial (!@#$%^&*)
                </ListItem>
                <ListItem>
                  <ListIcon as={checks.length ? CheckCircleIcon : CloseIcon} color={checks.length ? "green.500" : "gray.400"} />
                  Mínimo de 8 caracteres
                </ListItem>
                <ListItem>
                  <ListIcon as={match ? CheckCircleIcon : CloseIcon} color={match ? "green.500" : "gray.400"} />
                  As senhas devem coincidir
                </ListItem>
              </List>
              <Text mt={3} fontSize="sm">
                Força: {strength}
              </Text>
            </Box>

            <Button
              borderRadius="2xl"
              isDisabled={!canSubmit}
              isLoading={loading}
              size="md"
              fontFamily="Roboto"
              bg="#1C1D3B"
              color="white"
              _hover={{ bg: "#262750" }}
              _active={{ bg: "#121326" }}
              w="100%"
              onClick={handleRegister}
            >
              <Text fontSize="md">Criar conta</Text>
            </Button>

            <HStack justify="flex-end">
              <Link fontSize="sm" color="blue.500" href="/">
                Já tem conta? Entrar
              </Link>
            </HStack>

            {failure && (
              <Alert status="error">
                <AlertIcon />
                <Text fontSize="md" color="gray.600">
                  {errorMsg}
                </Text>
              </Alert>
            )}
          </VStack>
        </MotionBox>
      </Flex>

      <ToastContainer />
    </Flex>
  );
};

export default Register;
