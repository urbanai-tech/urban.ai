'use client';

import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Image as ChakraImage,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { EmailIcon, LockIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from 'react-toastify';
import "../../../i18n";
import { api, verificarUsuarioState } from "../service/api";

const MotionBox = motion(Box);

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const Login = () => {
  const router = useRouter();
  const { t, ready } = useTranslation();
  const [loading, setIsLoading] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    console.log(t("not_member"), ready);
  }, [t, ready]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);

      const hashedPassword = await sha256(password);

      const response = await api.post("/auth/login", {
        email,
        password: hashedPassword
      });

      const token = response.data.accessToken as string;

      localStorage.setItem("accessToken", token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      try {
        const { data, status } = await verificarUsuarioState(email);
        console.log('Status da requisição (verificarUsuarioState):', status);
        console.log('Dados retornados (verificarUsuarioState):', data);

        toast("Autenticação concluída com sucesso", { type: "success" });

        if (data.ativo) {
          setTimeout(() => {
            router.replace("/post-login");
          }, 2000);
        } else {
          setTimeout(() => {
            router.replace("/confirm-email/" + email);
          }, 2000);
        }

        return data;
      } catch (error) {
        toast("Não foi possível concluir a autenticação", { type: "error" });
        console.error('Erro ao verificar usuário:', error);
      }
      return;

    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.error(t("error.invalidCredentials"));
      } else {
        toast.error(t("error.unknown"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex
      h="100vh"
      w="100%"
      flexDirection={{ base: "column", md: "row" }}
      overflow="hidden"
    >
      <Box display={{ base: "none", md: "block" }} w={{ md: "50%" }} h="100vh">
        <ChakraImage
          src="/urbanai_only.png"
          alt="Login Visual"
          objectFit="cover"
          w="100%"
          h="100%"
        />
      </Box>

      <Flex
        w={{ base: "100%", md: "50%" }}
        h="100%"
        align="center"
        justify="center"
        bg="white"
        p={8}
        position="relative"
      >
        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          bg={{ base: "transparent", md: "white" }}
          p={{ base: 0, md: 8 }}
          borderRadius={{ base: "none", md: "2xl" }}
          w="100%"
          maxW="md"
        >
          <VStack spacing={6} align="stretch">
            <VStack w="full">
              <ChakraImage w={200} src="/urban-logo-transparent-soft.png" alt="Logo" />
            </VStack>

            <Box textAlign="center">
              <Heading size="lg" mb={2}>
                Entre na sua conta
              </Heading>
            </Box>

            <FormControl>
              <FormLabel fontSize="md">Email</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <EmailIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  size="lg"
                  type="email"
                  placeholder={t("email_placeholder")}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="md">Senha</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <LockIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  size="lg"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("password_placeholder")}
                />
                <InputRightElement h="full" pr={2}>
                  <IconButton
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    variant="ghost"
                    size="sm"
                    icon={showPassword ? <ViewOffIcon color="gray.500" /> : <ViewIcon color="gray.500" />}
                    onClick={() => setShowPassword(!showPassword)}
                    _hover={{ bg: "transparent", color: "blue.500" }}
                    _active={{ bg: "transparent" }}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>

            <HStack justify="space-between">
              <Link fontSize="sm" color="blue.500" href="/request-reset-password">
                Esqueceu a senha?
              </Link>
              <Link fontSize="sm" color="blue.500" href="/create">
                Não possui conta?
              </Link>
            </HStack>

            <Button
              borderRadius="2xl"
              isDisabled={loading}
              isLoading={loading}
              size="lg"
              bg="#1C1D3B"
              color="white"
              _hover={{ bg: "#262750" }}
              _active={{ bg: "#121326" }}
              w="100%"
              onClick={handleLogin}
            >
              <Text fontSize="md">{t("Entrar")}</Text>
            </Button>
          </VStack>
        </MotionBox>
      </Flex>

      <ToastContainer />
    </Flex>
  );
};

export default Login;
