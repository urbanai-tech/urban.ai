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
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { forgotPassword } from '@/app/service/api';
  import { ToastContainer, toast } from 'react-toastify';
      
const MotionBox = motion(Box);

const PasswordResetRequest = () => {

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failure, setFailure] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async () => {
    if (!email) {
      setErrorMsg("Por favor, insira seu e-mail.");
      setFailure(true);
      return;
    }

    try {
      setLoading(true);
      setFailure(false);
      setSuccessMsg('');

      const res = await forgotPassword(email);

      if (res.status !== 201) {
        throw new Error("Erro ao enviar e-mail de redefinição.");
      }

            toast("E-mail enviado!", { type: "success" });

      setSuccessMsg(`Um e-mail para reset de senha foi enviado para ${email}. 
        Verifique sua caixa de entrada e siga as instruções.`);

    } catch (error: any) {
      console.error("Erro handleSubmit:", error.response?.data || error.message);
      setFailure(true);
      setErrorMsg(error.response?.data?.message || "Erro ao enviar o e-mail de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setEmail('');
    setSuccessMsg('');
    setFailure(false);
    setErrorMsg('');
  };

  return (
    <Flex
      minH="100vh"
      w="100%"
      align="center"
      justify="center"
      bg="gray.50"
      p={4}
    >
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

        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Heading size="xl" mb={2} color="blue.600">
              Resetar Senha
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Insira seu e-mail para receber o link de redefinição
            </Text>
          </Box>

          {/* Campo e Botão só aparecem se ainda não foi enviado */}
          {!successMsg && (
            <>
              <FormControl isDisabled={loading}>
                <FormLabel fontWeight="semibold">E-mail</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  size="lg"
                  focusBorderColor="blue.500"
                />
              </FormControl>

              <Button
                size="lg"
                bg="#1C1D3B"
                color="white"
                _hover={{ bg: "#262750" }}   // ~6% mais claro
                _active={{ bg: "#121326" }}
                isLoading={loading}
                loadingText="Enviando..."
                onClick={handleSubmit}
                transition="all 0.2s"
                isDisabled={loading}
              >
                Resetar Senha
              </Button>
            </>
          )}

          {failure && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {errorMsg}
            </Alert>
          )}

          {successMsg && (
            <>
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                {successMsg}
              </Alert>

              <Button
                size="md"
                variant="outline"
                colorScheme="blue"
                onClick={handleRetry}
              >
                Tentar novamente
              </Button>
            </>
          )}

          <HStack justify="center" pt={2}>
            <Text>Lembrou da senha?</Text>
            <Link color="blue.500" fontWeight="bold" href="/">
              Fazer login
            </Link>
          </HStack>
        </VStack>
      </MotionBox>
         <ToastContainer />
    </Flex>
  );
};

export default PasswordResetRequest;
