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
  Select,
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
  updateProfileById,
} from '@/app/service/api';

type PricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'ai';

const PRICING_PRESETS: Record<PricingStrategy, { inicial: number; final: number | null }> = {
  conservative: { inicial: 5, final: 10 },
  balanced: { inicial: 10, final: 20 },
  aggressive: { inicial: 15, final: 35 },
  ai: { inicial: 5, final: null },
};

export default function ConfiguracoesPage() {
  const surface = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.50', 'gray.700');
  const border = useColorModeValue('gray.200', 'whiteAlpha.300');

  const [form, setForm] = React.useState({
    nome: '',
    email: '',
    percentualInicial: '',
    percentualFinal: '',
    pricingStrategy: 'balanced',
    operationMode: 'notifications',
  });

  const [userId, setUserId] = React.useState<string | null>(null);
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

    setUserId(id);
    setLoading(true);

    // Buscar dados do perfil
    getProfileById()
      .then((userData) => {
        setForm((prev) => ({
          ...prev,
          nome: userData.username || '',
          email: userData.email || '',
          pricingStrategy: userData.pricingStrategy || 'balanced',
          operationMode: userData.operationMode || 'notifications',
          percentualInicial: userData.percentualInicial?.toString().replace('.', ',') || '',
          percentualFinal: userData.percentualFinal?.toString().replace('.', ',') || '',
        }));
      })
      .catch(() => {
        toast.error('Falha ao carregar perfil');
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    
    if (name === 'percentualInicial' || name === 'percentualFinal') {
       const sanitizedValue = value.replace(/[^0-9,.-]/g, '');
       setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
       return;
    }

    if (name === 'pricingStrategy' && PRICING_PRESETS[value as PricingStrategy]) {
       const preset = PRICING_PRESETS[value as PricingStrategy];
       setForm((prev) => ({ 
         ...prev, 
         [name]: value,
         percentualInicial: preset.inicial.toString(),
         percentualFinal: preset.final ? preset.final.toString() : ''
       }));
       return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  if (loading) {
    return (
      <Center height="300px">
        <Spinner size="xl" />
      </Center>
    );
  }

  const isButtonDisabled = !form.percentualInicial; // Final can be empty for AI mode

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
            
            {/* INÍCIO - Configurações do Motor AI */}
            <GridItem>
              <FormControl>
                <FormLabel>Estratégia de Precificação (Motor de IA)</FormLabel>
                <Select 
                  name="pricingStrategy" 
                  value={form.pricingStrategy} 
                  onChange={handleChange}
                  size="lg"
                  bg="white"
                >
                  <option value="conservative">Conservadora (-5% a +10%)</option>
                  <option value="balanced">Moderada (-10% a +20%)</option>
                  <option value="aggressive">Agressiva (-15% a +35%)</option>
                  <option value="ai">Piloto Automático IA (Livre)</option>
                </Select>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Isso preencherá automaticamente os seus limites permitidos logo abaixo.
                </Text>
              </FormControl>
            </GridItem>

            <GridItem>
              <FormControl>
                <FormLabel>Modo de Operação</FormLabel>
                <Select 
                  name="operationMode" 
                  value={form.operationMode} 
                  onChange={handleChange}
                  size="lg"
                  bg="white"
                >
                  <option value="notifications">Apenas Notificações (Recomendado)</option>
                  <option value="auto" disabled>Automático (Em Breve)</option>
                </Select>
                 <Text fontSize="sm" color="gray.500" mt={1}>
                  Aguarde atualizações para aplicar preços diretamente no painel do Airbnb.
                </Text>
              </FormControl>
            </GridItem>
            {/* FIM - Configurações do Motor AI */}

            <GridItem>
              <FormControl isRequired>
                <FormLabel>Limite de Queda (%) - Max Desconto</FormLabel>
                <Input
                  type="text"
                  name="percentualInicial"
                  value={form.percentualInicial}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="Ex: 5 ou 10"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Queda máxima permitida em relação ao sub-preço de mercado.
                </Text>
              </FormControl>
            </GridItem>

            <GridItem>
              <FormControl>
                <FormLabel>Limite de Alta (%) - Max Lucro</FormLabel>
                <Input
                  type="text"
                  name="percentualFinal"
                  value={form.percentualFinal}
                  onChange={handleChange}
                  size="lg"
                  variant="filled"
                  placeholder="Deixe vazio para IA livre"
                  isDisabled={form.pricingStrategy === 'ai'}
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Alta extrema permitida. No modo Piloto IA, este teto é ilimitado.
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
              isDisabled={isButtonDisabled || saving}
              isLoading={saving}
              loadingText="Salvando..."
              onClick={async () => {
                if (!userId) return;
                setSaving(true);
                const inicial = parseFloat(form.percentualInicial.replace(',', '.'));
                const final = form.percentualFinal ? parseFloat(form.percentualFinal.replace(',', '.')) : null;

                if (isNaN(inicial)) {
                  toast.error('O percentual de queda é obrigatório e deve ser numérico.');
                  setSaving(false);
                  return;
                }

                try {
                  // Atualiza perfil (strat / mode / limites)
                  await updateProfileById(userId, {
                    pricingStrategy: form.pricingStrategy,
                    operationMode: form.operationMode,
                    percentualInicial: inicial,
                    percentualFinal: final
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
              Salvar Configurações
            </Button>
          </Flex>
        </Box>
      </Box>

      <ToastContainer />
    </Container>
  );
}
