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
  Text,
  VStack,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { FiMail, FiRefreshCw } from 'react-icons/fi';
import { useInterval } from '@chakra-ui/react';
import { confirmarEmail, enviarCodigo, getProfile } from '@/app/service/api';
import { ToastContainer, toast } from 'react-toastify';


const MotionBox = motion(Box);

const EmailConfirmation = () => {


  const params = useParams();
  const email = params.id && !Array.isArray(params.id) ? decodeURIComponent(params.id) : '';



  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string>('');
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) return; // espera o email estar definido

    const sendCode = async () => {
      try {
        const result = await enviarCodigo(email);
        console.log('Código enviado com sucesso:', result);
      } catch (err) {
        console.error('Erro ao enviar código:', err);
      }
    };

    sendCode(); // chama a função uma vez
  }, [email]);



  // Contador para reenvio
  useInterval(() => {
    if (countdown > 0) {
      setCountdown(countdown - 1);
    } else {
      setResendDisabled(false);
    }
  }, resendDisabled ? 1000 : null);

  // Validação do código em tempo real
  useEffect(() => {
    setIsCodeValid(/^\d{6}$/.test(code));
  }, [code]);

  // Foco inicial
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);


  const decideRedirect = async (accessToken: string) => {
    try {
      const { data: profile } = await getProfile();

      const notFirstTime =
        profile?.onboardingCompleted === true ||
        (typeof profile?.loginCount === "number" && profile.loginCount > 1);

      router.replace(notFirstTime ? "/dashboard" : "/app");
    } catch (e) {
      console.error("Erro ao obter perfil:", e);
      router.replace("/app"); // fallback
    }

  };

  const handleCodeChange = (index: number, value: string) => {
    if (/^\d$/.test(value) || value === '') {
      const newCode = code.split('');
      while (newCode.length < 6) newCode.push('');
      newCode[index] = value;
      setCode(newCode.join(''));

      if (value && index < 5) {
        inputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setCode(pastedData);
      setTimeout(() => inputsRef.current[5]?.focus(), 10);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isCodeValid) return;

    try {
      setLoading(true);

      const result = await confirmarEmail(email, code);

      if (result.data.ok) {
        toast("Sua conta foi ativada com sucesso.", { type: "success" });
        await decideRedirect("token_nao_necessario");
      } else {
        toast.error(result.data.motivo || 'Erro ao confirmar e-mail.');
      }

    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  const handleResendCode = async () => {
    try {
      setIsResending(true);
      setResendDisabled(true);
      setCountdown(60);

      try {
        const result = await enviarCodigo(email);
        toast("Verifique seu e-mail para obter o novo código", { type: "success" });
        console.log('Código enviado com sucesso:', result);
      } catch (err) {
        console.error('Erro ao enviar código:', err);
      }


    } catch {
      toast.error('Erro ao reenviar código. Tente novamente mais tarde.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      w="100%"
      align="center"
      justify="center"
      bgGradient="linear(to-br, blue.50, purple.50)"
      p={4}
    >
      <MotionBox
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        w="100%"
        maxW="md"
        bg="white"
        borderRadius="2xl"
        boxShadow="xl"
        p={8}
      >
        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Box display="inline-block" p={4} bg="blue.100" borderRadius="full" mb={4}>
              <FiMail size={40} color="#3182CE" />
            </Box>
            <Heading size="xl" mb={2} color="blue.700">Confirme seu e-mail</Heading>
            <Text fontSize="md" color="gray.600">
              Enviamos um código de confirmação para seu e-mail
            </Text>
            <Text fontWeight="medium" color="gray.700" mt={1}>{email}</Text>
          </Box>

          <FormControl>
            <FormLabel fontWeight="semibold" textAlign="center">
              Digite o código de 6 dígitos
            </FormLabel>

            <Flex justify="center" gap={3} mt={4}>
              {[...Array(6)].map((_, index) => (
                <Box key={index}>
                  <input
                    ref={(el) => {
                      inputsRef.current[index] = el;
                    }}
                    value={code[index] || ''}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    style={{
                      width: '55px',
                      height: '55px',
                      textAlign: 'center',
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: `2px solid ${code[index] ? '#3182CE' : '#E2E8F0'}`,
                      outline: 'none',
                    }}
                  />

                </Box>
              ))}
            </Flex>

            <Box mt={4} textAlign="center">
              <Button
                variant="link"
                colorScheme="blue"
                onClick={handleResendCode}
                isLoading={isResending}
                isDisabled={resendDisabled}
                leftIcon={<FiRefreshCw />}
              >
                {resendDisabled ? `Reenviar código em ${countdown}s` : 'Reenviar código'}
              </Button>
            </Box>
          </FormControl>

          <Button
            size="lg"
            colorScheme="blue"
            isLoading={loading}
            loadingText="Verificando..."
            isDisabled={!isCodeValid}
            onClick={handleSubmit}
            mt={4}
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
            transition="all 0.2s"
            borderRadius="xl"
            height="50px"
            fontSize="md"
          >
            Confirmar E-mail
          </Button>



          <Box mt={6} textAlign="center" pt={4} borderTopWidth="1px" borderTopColor="gray.100">
            <Text fontSize="sm" color="gray.600">
              Não recebeu o código? Verifique sua pasta de spam ou{' '}
              <Button variant="link" colorScheme="blue" ml={1} onClick={() => router.push('/suporte')}>
                contate o suporte
              </Button>
            </Text>
          </Box>
        </VStack>
      </MotionBox>
      <ToastContainer />
    </Flex>
  );
};

export default EmailConfirmation;
