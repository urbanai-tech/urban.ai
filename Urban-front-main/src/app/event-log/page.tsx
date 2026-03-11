'use client';

import React from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  FormControl,
  FormLabel,
  Input,
  useColorModeValue,
  Divider,
  Text,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { FiUser } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  getProfileById,
  requestCreateOrUpdatePercentual,
  requestFindPercentualByUserId,
} from '@/app/service/api';

export default function ConfiguracoesPage() {
  const surface = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.50', 'gray.700');
  const border = useColorModeValue('gray.200', 'whiteAlpha.300');

  const [form, setForm] = React.useState({
    nome: '',
    email: '',
    percentualInicial: '',
    percentualFinal: '',
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  function getUserIdFromToken(): string | null {
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  React.useEffect(() => {
    const lsId =
      typeof window !== 'undefined' ? (localStorage.getItem('userId') || '').trim() : '';
    const fallbackId = getUserIdFromToken();
    const id = lsId || fallbackId;

    if (!id) {
      setLoading(false);
      toast.info('Sessão expirada');
      return;
    }

    setLoading(true);

    // Buscar dados do perfil
    getProfileById()
      .then((userData) => {
        setForm((prev) => ({
          ...prev,
          nome: userData.username || '',
          email: userData.email || '',
        }));
      })
      .catch(() => {
        toast.error('Falha ao carregar perfil');
      });

    // Buscar percentuais do usuário
    requestFindPercentualByUserId()
      .then((data: any) => {
        if (data) {
          setForm((prev) => ({
            ...prev,
            percentualInicial: data.percentualInicial?.toString().replace('.', ',') || '',
            percentualFinal: data.percentualFinal?.toString().replace('.', ',') || '',
          }));
        }
      })
      .catch((error: any) => {
        console.error('Erro ao carregar percentuais:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    // Permite números, vírgula, ponto e sinal negativo
    const sanitizedValue = value.replace(/[^0-9,.-]/g, '');
    setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
  }

  if (loading) {
    return (
      <Center height="300px">
        <Spinner size="xl" />
      </Center>
    );
  }

  const isButtonDisabled = !form.percentualInicial || !form.percentualFinal;

  return (
    <Container maxW="7xl" py={8}>
      <Flex align="center" justify="space-between" mb={6}>
        <Heading size="2xl">Configurações</Heading>
      </Flex>

      <Box bg={muted} borderRadius="xl" p={2} mb={6}>
        <Box bg={surface} borderRadius="xl" borderWidth="1px" borderColor={border} p={6}>
          <Flex align="center" gap={3} mb={4}>
            <Icon as={FiUser} boxSize={6} />
            <Heading size="lg">Informações Pessoais</Heading>
          </Flex>
          <Divider mb={6} />

          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Nome Completo</FormLabel>
                <Input
                  isDisabled
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="Seu nome"
                />
              </FormControl>
            </GridItem>

            <GridItem>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  isDisabled
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="seu@email.com"
                />
              </FormControl>
            </GridItem>

            <GridItem>
              <FormControl isRequired>
                <FormLabel>Percentual Inicial (%)</FormLabel>
                <Input
                  type="text"
                  name="percentualInicial"
                  value={form.percentualInicial}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="Digite a partir de quanto aceitar automático"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Digite a partir de quanto você deseja aceitar automático as sugestões
                </Text>
              </FormControl>
            </GridItem>

            <GridItem>
              <FormControl isRequired>
                <FormLabel>Percentual Final (%)</FormLabel>
                <Input
                  type="text"
                  name="percentualFinal"
                  value={form.percentualFinal}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="Digite até qual percentual aceitar automático"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Digite até qual percentual você deseja aceitar automático as sugestões
                </Text>
              </FormControl>
            </GridItem>
          </Grid>

          <Flex justify="flex-end" mt={6}>
            <Button
              colorScheme="teal"
              size="md"
              fontWeight="bold"
              borderRadius="xl"
              boxShadow="sm"
              _hover={{ boxShadow: 'md', transform: 'scale(1.02)' }}
              isDisabled={isButtonDisabled || saving} // desabilita durante o saving
              isLoading={saving} // loading no botão
              loadingText="Salvando..."
              onClick={async () => {
                setSaving(true);
                const inicial = parseFloat(form.percentualInicial.replace(',', '.'));
                const final = parseFloat(form.percentualFinal.replace(',', '.'));

                if (isNaN(inicial) || isNaN(final)) {
                  toast.error('Por favor, insira números válidos.');
                  setSaving(false);
                  return;
                }

                try {
                  await requestCreateOrUpdatePercentual({
                    percentualInicial: inicial,
                    percentualFinal: final,
                  });
                  toast.success('Configurações salvas com sucesso!');
                } catch (error) {
                  console.error(error);
                  toast.error('Erro ao salvar configurações');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Salvar
            </Button>
          </Flex>
        </Box>
      </Box>

      <ToastContainer />
    </Container>
  );
}
