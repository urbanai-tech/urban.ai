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
  ai: { inicial: 25, final: 45 },
};

function formatPercent(value: number | string | null | undefined, absolute = false) {
  if (value === null || value === undefined || value === '') return '';
  const numericValue = Number(value.toString().replace(',', '.'));
  const displayValue = absolute && !Number.isNaN(numericValue) ? Math.abs(numericValue) : value;

  return displayValue.toString().replace('.', ',');
}

function parsePercentInput(value: string) {
  const trimmedValue = value.trim();

  if (!/^\d+(?:[,.]\d+)?$/.test(trimmedValue)) return null;

  return Number(trimmedValue.replace(',', '.'));
}

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

  React.useEffect(() => {
    const id = 'me';

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
          percentualInicial: formatPercent(userData.percentualInicial, true),
          percentualFinal: formatPercent(userData.percentualFinal),
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
       const sanitizedValue = value.replace(/[^0-9,.]/g, '');
       setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
       return;
    }

    if (name === 'pricingStrategy' && PRICING_PRESETS[value as PricingStrategy]) {
       const preset = PRICING_PRESETS[value as PricingStrategy];
       setForm((prev) => ({ 
         ...prev, 
         [name]: value,
         percentualInicial: preset.inicial.toString(),
         percentualFinal: preset.final !== null ? preset.final.toString() : ''
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
                  <option value="ai">Piloto Automático IA (com teto sistêmico)</option>
                </Select>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Isso preencherá automaticamente os limites para novas sugestões. A queda é salva como valor positivo.
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
                  Queda máxima permitida para novas sugestões. Informe 5 para permitir até -5%.
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
                  placeholder="Controlado pelo teto sistêmico"
                  isDisabled={form.pricingStrategy === 'ai'}
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Alta máxima permitida para novas sugestões. No Piloto IA, vale o teto sistêmico configurado.
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
                const finalText = form.percentualFinal.trim();
                const inicial = parsePercentInput(form.percentualInicial);
                const final = finalText ? parsePercentInput(finalText) : null;

                if (inicial === null || inicial < 0) {
                  toast.error('A queda é obrigatória e deve ser um número maior ou igual a zero.');
                  setSaving(false);
                  return;
                }

                if (finalText && (final === null || final < 0)) {
                  toast.error('A alta deve ser um número maior ou igual a zero quando preenchida.');
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
