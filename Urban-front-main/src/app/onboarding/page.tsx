'use client';

import React, { useState } from 'react';
import {
  Flex, VStack, HStack, Box, Heading, Text, Input,
  FormControl, FormLabel, Switch, Stack, Slider, SliderTrack,
  SliderFilledTrack, SliderThumb, SliderMark,
  Button, Image, Container, Badge, SimpleGrid,
  List, ListItem, ListIcon, Spinner, Tooltip
} from '@chakra-ui/react';
import { CheckIcon, InfoIcon } from '@chakra-ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import '../../../i18n';
import {
  getHostId, getUserManagedListings, registerProperties,
  createMultipleAddresses, resolveAirbnbUrl,
  createCheckoutSession, updateProfileById, getProfileById
} from '../service/api';
import { FiMapPin, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { BsRobot } from 'react-icons/bs';
import { ToastContainer, toast } from 'react-toastify';
import { loadStripe } from '@stripe/stripe-js';

const MotionBox = motion(Box);
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const TOTAL_STEPS = 5;

interface Property {
  id: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
  pictureUrl: string;
}

interface RegisteredProperty {
  id: string;
  titulo: string;
  id_do_anuncio: string;
  pictureUrl: string;
  ativo: boolean;
  user?: { id: string };
}

interface SelectedPropertiesState {
  [key: string]: boolean;
}

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 2 — Link Airbnb
  const [airbnbLink, setAirbnbLink] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<SelectedPropertiesState>({});
  const [selectAll, setSelectAll] = useState(false);

  // Step 4 — Configurações do motor de IA
  const [distanceKm, setDistanceKm] = useState(30);

  // =====================================================
  //  FUNÇÕES DE SCRAPING (Mesma lógica que já funcionava)
  // =====================================================

  const extractAirbnbUserId = (link: string): string | null => {
    if (!link || !link.includes('airbnb.com')) return null;
    const regex = /\/users\/show\/(\d+)/;
    const match = link.match(regex);
    return match && match[1] ? match[1] : null;
  };

  const extractAirbnbPropertyId = (link: string): string | null => {
    if (!link || !link.includes('airbnb.com')) return null;
    const patterns = [
      /\/rooms\/(\d+)/,
      /airbnb\.com\.?\w*\/rooms\/(\d+)/i,
      /airbnb\.com\.?\w*\/p\/(\d+)/i
    ];
    for (const regex of patterns) {
      const match = link.match(regex);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const extractAirbnbListingId = (url: string): string | null => {
    try {
      const regex = /editor\/(\d+)\/details/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const initializeSelectedProperties = (list: Property[]) => {
    const initialSelectedState: SelectedPropertiesState = {};
    list.forEach(prop => {
      initialSelectedState[prop.id_do_anuncio] = true;
      prop.ativo = true;
    });
    setSelectedProperties(initialSelectedState);
    setSelectAll(list.length > 0);
  };

  const fetchUserProperties = async () => {
    if (!airbnbLink) {
      toast("Para continuar, insira um link do Airbnb.", { type: "info" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await resolveAirbnbUrl(airbnbLink);
      setAirbnbLink(result.finalUrl);

      const id = extractAirbnbListingId(airbnbLink);
      let urlEditor = null;
      if (id) {
        urlEditor = `https://www.airbnb.com/rooms/${id}`;
      }

      const propertyIdExtracted = extractAirbnbPropertyId(urlEditor ? urlEditor : result.finalUrl);

      let userIdFromGetHostId = null;
      if (propertyIdExtracted) {
        const data = await getHostId(propertyIdExtracted);
        userIdFromGetHostId = data?.result.hostId;
      }

      let userId = userIdFromGetHostId || extractAirbnbUserId(urlEditor ? urlEditor : result.finalUrl);

      if (!userId) {
        toast("Por favor, insira um link válido do perfil ou imóvel do Airbnb.", { type: "error" });
        setIsLoading(false);
        return;
      }

      const listings = await getUserManagedListings(userId);

      if (!listings || listings.length === 0) {
        toast("Não encontramos imóveis neste perfil. Verifique o link.", { type: "warning" });
        setIsLoading(false);
        return;
      }

      const mappedProperties: Property[] = listings.map((item: any) => ({
        id: item.id || 0,
        titulo: item.titulo ?? item.name ?? 'Sem título',
        id_do_anuncio: item.id_do_anuncio ?? '',
        ativo: true,
        pictureUrl: item.pictureUrl ?? '',
      }));

      setProperties(mappedProperties);
      initializeSelectedProperties(mappedProperties);
      setStep(3);
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
      toast("Não foi possível buscar seus imóveis. Verifique o link e tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePropertyToggle = (id_do_anuncio: string) => {
    setSelectedProperties(prev => {
      const newSelected = { ...prev, [id_do_anuncio]: !prev[id_do_anuncio] };
      setSelectAll(Object.values(newSelected).every(Boolean));
      return newSelected;
    });
  };

  const handleSelectAllToggle = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    const updatedSelectedState: SelectedPropertiesState = {};
    properties.forEach(prop => {
      updatedSelectedState[prop.id_do_anuncio] = newSelectAll;
    });
    setSelectedProperties(updatedSelectedState);
  };

  const handleRegisterProperties = async () => {
    const selectedPropertiesList = properties.filter(
      prop => selectedProperties[prop.id_do_anuncio] === true
    );

    if (selectedPropertiesList.length === 0) {
      toast("Selecione pelo menos uma propriedade.", { type: "warning" });
      return;
    }

    try {
      setIsLoading(true);
      const toRegister = selectedPropertiesList.map(prop => ({
        id: prop.id,
        titulo: prop.titulo,
        id_do_anuncio: prop.id_do_anuncio,
        ativo: true,
        pictureUrl: prop.pictureUrl,
      }));

      const response = await registerProperties(toRegister);
      const registered: RegisteredProperty[] = Array.isArray((response as any)?.data)
        ? (response as any).data
        : (response as any);

      if (Array.isArray(registered)) {
        localStorage.setItem('registeredProperties', JSON.stringify(registered));
      }

      const addressesToRegister = registered.map((prop: any) => {
        const estado = 'A definir';
        return {
          cep: '00000-000',
          numero: 'S/N',
          logradouro: 'A definir',
          bairro: 'A definir',
          cidade: 'A definir',
          estado: estado.length > 2 ? estado.substring(0, 2) : null,
          list: { id: prop.id_do_anuncio },
        };
      });

      await createMultipleAddresses(addressesToRegister);

      toast(`${selectedPropertiesList.length} propriedade(s) registrada(s) com sucesso!`, { type: "success" });
      setStep(4); // Vai para configurações

    } catch (error) {
      console.error('Erro ao registrar propriedades:', error);
      toast("Falha ao configurar propriedades. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  //  STEP 4: Salvar configurações do motor de IA
  // =====================================================
  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      const profile = await getProfileById();
      await updateProfileById(profile.id, { distanceKm });
      toast("Configurações salvas! Vamos ativar o seu sistema.", { type: "success" });
      setStep(5);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast("Erro ao salvar. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  //  STEP 5: Paywall — Checkout Stripe
  // =====================================================
  const handleCheckout = async (planId: string) => {
    setIsLoading(true);
    try {
      const { sessionId } = await createCheckoutSession(planId);
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      } else {
        toast("Erro ao carregar o Stripe.", { type: "error" });
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao iniciar o pagamento. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  //  ANIMAÇÕES
  // =====================================================
  const pageVariants = {
    initial: { opacity: 0, x: 40 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -40 }
  };

  const selectedCount = Object.values(selectedProperties).filter(Boolean).length;

  return (
    <Flex w="100%" minH="100vh" direction="column" bg="gray.50" align="center">
      {/* Topbar limpo */}
      <Flex w="100%" justify="center" py={6} borderBottom="1px solid" borderColor="gray.100" bg="white">
        <Image src="/ul.png" alt="Urban AI Logo" height="auto" width="140px" />
      </Flex>

      {/* Barra de progresso */}
      <Container maxW="container.md" mt={6} mb={2}>
        <HStack spacing={0} w="100%">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <Box key={i} flex={1} h="4px" bg={i < step ? "blue.500" : "gray.200"} borderRadius="full"
              mx={0.5} transition="background 0.4s ease" />
          ))}
        </HStack>
        <Text fontSize="xs" color="gray.400" textAlign="right" mt={1}>
          Etapa {step} de {TOTAL_STEPS}
        </Text>
      </Container>

      <Container maxW="container.md" pb={12}>
        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          bg="white"
          borderRadius="2xl"
          boxShadow="0 4px 24px rgba(0,0,0,0.06)"
          p={{ base: 6, md: 12 }}
          overflow="hidden"
        >
          <AnimatePresence mode="wait">

            {/* ════════════════════════════════════════════════
                PASSO 1: Boas Vindas
            ════════════════════════════════════════════════ */}
            {step === 1 && (
              <MotionBox key="step1" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={6} align="center" textAlign="center">
                  <Box bg="orange.50" color="orange.500" p={4} rounded="full" mb={6}>
                    <BsRobot size={48} />
                  </Box>
                  <Heading size="xl" color="gray.800" lineHeight="shorter">
                    Bem-vindo ao Urban AI
                  </Heading>
                  <Text fontSize="lg" color="gray.500" maxW="440px" lineHeight="tall">
                    Nosso motor de inteligência artificial irá analisar seu mercado local, eventos
                    próximos e a concorrência para maximizar a receita dos seus imóveis do Airbnb
                    de forma totalmente automática.
                  </Text>
                  <Text fontSize="sm" color="gray.400" maxW="380px">
                    O setup inicial leva menos de 2 minutos.
                  </Text>

                  <Button
                    mt={4} bg="#ff5a5f" color="white" size="lg" px={10} h="56px" fontSize="lg"
                    _hover={{ bg: '#e0484d', transform: 'translateY(-2px)', boxShadow: 'lg' }}
                    _active={{ bg: '#d43b40' }}
                    transition="all 0.2s"
                    onClick={() => setStep(2)}
                  >
                    Começar configuração
                  </Button>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 2: Inserção do Link do Airbnb
            ════════════════════════════════════════════════ */}
            {step === 2 && (
              <MotionBox key="step2" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={8} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 1 de 3</Text>
                    <Heading size="lg" mb={3} color="gray.800">Conecte seu Airbnb</Heading>
                    <Text color="gray.500" maxW="400px" mx="auto">
                      Cole abaixo a URL pública do seu perfil <strong>OU</strong> de qualquer
                      anúncio seu. Nós identificamos automaticamente todos os seus imóveis.
                    </Text>
                  </Box>

                  <FormControl>
                    <FormLabel fontSize="md" fontWeight="semibold" color="gray.700">
                      Link do Perfil ou Anúncio
                    </FormLabel>
                    <Input
                      size="lg" type="url"
                      placeholder="https://www.airbnb.com.br/users/show/123456789"
                      value={airbnbLink}
                      onChange={(e) => setAirbnbLink(e.target.value)}
                      focusBorderColor="blue.500"
                      bg="gray.50" border="2px solid" borderColor="gray.200"
                      _hover={{ borderColor: "gray.300" }} h="60px"
                    />
                    <Text fontSize="xs" mt={1} color="gray.400">
                      Aceita links de /users/show/ID ou /rooms/ID
                    </Text>
                  </FormControl>

                  <Flex gap={4}>
                    <Button variant="ghost" size="lg" onClick={() => setStep(1)} color="gray.500">
                      Voltar
                    </Button>
                    <Button
                      bg="#2E3748" color="white" _hover={{ bg: '#252E3E' }}
                      _active={{ bg: '#1B2330' }} size="lg" flex={1}
                      isLoading={isLoading}
                      loadingText="Rastreando imóveis..."
                      onClick={fetchUserProperties}
                    >
                      Buscar propriedades
                    </Button>
                  </Flex>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 3: Seleção das Propriedades
            ════════════════════════════════════════════════ */}
            {step === 3 && (
              <MotionBox key="step3" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={6} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 2 de 3</Text>
                    <Heading size="lg" mb={2} color="gray.800">Selecionar Imóveis</Heading>
                    <Text color="gray.500">
                      Encontramos <strong>{properties.length}</strong> {properties.length === 1 ? 'imóvel' : 'imóveis'}.
                      Ative os que deseja monitorar com a inteligência do Urban AI.
                    </Text>
                  </Box>

                  <Box p={4} bg="gray.50" borderRadius="lg" border="1px solid" borderColor="gray.200">
                    <FormControl display="flex" alignItems="center" justifyContent="space-between"
                      mb={4} pb={4} borderBottom="1px solid" borderColor="gray.200">
                      <FormLabel mb="0" fontWeight="bold" color="gray.800">
                        Ativar todos ({properties.length})
                      </FormLabel>
                      <Switch colorScheme="green" size="lg" isChecked={selectAll}
                        onChange={handleSelectAllToggle} />
                    </FormControl>

                    <Stack spacing={3} maxH="280px" overflowY="auto" pr={2}>
                      {properties.map((property) => (
                        <FormControl
                          key={property.id_do_anuncio} display="flex" alignItems="center"
                          justifyContent="space-between" bg="white" p={3} borderRadius="md"
                          border="1px solid"
                          borderColor={selectedProperties[property.id_do_anuncio] ? 'blue.200' : 'gray.200'}
                          boxShadow="sm" transition="all 0.2s"
                        >
                          <Flex align="center" gap={3}>
                            {property.pictureUrl ? (
                              <Image src={property.pictureUrl} alt={property.titulo}
                                boxSize="44px" objectFit="cover" borderRadius="md" />
                            ) : (
                              <Box boxSize="44px" bg="gray.200" borderRadius="md" />
                            )}
                            <FormLabel mb="0" fontWeight="medium" color="gray.700"
                              noOfLines={1} maxW="260px">
                              {property.titulo}
                            </FormLabel>
                          </Flex>
                          <Switch colorScheme="blue"
                            isChecked={selectedProperties[property.id_do_anuncio] || false}
                            onChange={() => handlePropertyToggle(property.id_do_anuncio)} />
                        </FormControl>
                      ))}
                    </Stack>
                  </Box>

                  <Flex gap={4} mt={2}>
                    <Button variant="ghost" size="lg" onClick={() => setStep(2)} color="gray.500"
                      isDisabled={isLoading}>
                      Voltar
                    </Button>
                    <Button colorScheme="blue" size="lg" flex={1}
                      onClick={handleRegisterProperties}
                      isDisabled={selectedCount === 0}
                      isLoading={isLoading}
                      loadingText="Registrando...">
                      Registrar {selectedCount} {selectedCount === 1 ? 'imóvel' : 'imóveis'}
                    </Button>
                  </Flex>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 4: Configurações do Motor de IA
            ════════════════════════════════════════════════ */}
            {step === 4 && (
              <MotionBox key="step4" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={8} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 3 de 3</Text>
                    <Heading size="lg" mb={3} color="gray.800">Calibrar o Motor de IA</Heading>
                    <Text color="gray.500" maxW="440px" mx="auto">
                      Estas preferências ajustam como nossa inteligência escaneia eventos e
                      concorrentes ao redor dos seus imóveis.
                    </Text>
                  </Box>

                  {/* Raio de busca de eventos */}
                  <Box bg="gray.50" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200">
                    <Flex justify="space-between" align="center" mb={4}>
                      <Box>
                        <Text fontWeight="bold" color="gray.800" fontSize="md">
                          Raio de Análise de Eventos
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          Define o alcance, em km, que o motor analisará eventos próximos aos seus imóveis.
                        </Text>
                      </Box>
                      <Tooltip label="Eventos muito distantes (acima de 50km) impactam menos no preço do seu imóvel."
                        hasArrow placement="top">
                        <InfoIcon color="gray.400" />
                      </Tooltip>
                    </Flex>

                    <Box px={4} pt={6} pb={2}>
                      <Slider
                        min={5} max={100} step={5}
                        value={distanceKm}
                        onChange={(val) => setDistanceKm(val)}
                        colorScheme="blue"
                      >
                        <SliderMark value={10} mt={3} ml={-2} fontSize="xs" color="gray.400">
                          10km
                        </SliderMark>
                        <SliderMark value={30} mt={3} ml={-2} fontSize="xs" color="gray.400">
                          30km
                        </SliderMark>
                        <SliderMark value={50} mt={3} ml={-2} fontSize="xs" color="gray.400">
                          50km
                        </SliderMark>
                        <SliderMark value={100} mt={3} ml={-4} fontSize="xs" color="gray.400">
                          100km
                        </SliderMark>
                        <SliderMark
                          value={distanceKm}
                          textAlign="center"
                          bg="blue.500"
                          color="white"
                          mt="-10"
                          ml="-5"
                          w="10"
                          borderRadius="md"
                          fontSize="sm"
                          fontWeight="bold"
                        >
                          {distanceKm}
                        </SliderMark>
                        <SliderTrack h="8px" borderRadius="full">
                          <SliderFilledTrack />
                        </SliderTrack>
                        <SliderThumb boxSize={6} bg="blue.500" border="3px solid white" boxShadow="md" />
                      </Slider>
                    </Box>
                  </Box>

                  <Flex gap={4} mt={2}>
                    <Button variant="ghost" size="lg" color="gray.500"
                      onClick={() => setStep(5)} isDisabled={isLoading}>
                      Pular
                    </Button>
                    <Button colorScheme="blue" size="lg" flex={1}
                      onClick={handleSaveConfig}
                      isLoading={isLoading}
                      loadingText="Salvando...">
                      Salvar e continuar
                    </Button>
                  </Flex>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 5: Paywall — Ativação do Plano
            ════════════════════════════════════════════════ */}
            {step === 5 && (
              <MotionBox key="step5" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={8} align="stretch">
                  <Box textAlign="center">
                    <Box p={4} bg="green.50" borderRadius="full" display="inline-flex" mb={4}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#38A169"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </Box>
                    <Heading size="lg" mb={3} color="gray.800">
                      Tudo configurado!
                    </Heading>
                    <Text color="gray.500" maxW="440px" mx="auto">
                      Seus imóveis estão conectados e o motor de inteligência está pronto.
                      Escolha um plano para ativar as recomendações diárias automaticamente.
                    </Text>
                  </Box>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    {/* Teste grátis */}
                    <Box position="relative" borderRadius="xl" p={6} bg="gray.50"
                      border="2px solid" borderColor="gray.200"
                      _hover={{ borderColor: 'green.400', boxShadow: 'md' }}
                      transition="all 0.3s" cursor="pointer"
                      onClick={() => handleCheckout('trial')}>
                      <Badge position="absolute" top={3} right={3} colorScheme="green"
                        fontSize="0.75rem" px={2} py={0.5} borderRadius="full">
                        7 dias grátis
                      </Badge>
                      <VStack spacing={3} pt={4}>
                        <Text fontSize="lg" fontWeight="bold" color="gray.700">Trial Gratuito</Text>
                        <Heading size="2xl" color="green.500">Grátis</Heading>
                        <Button colorScheme="green" size="md" w="100%" mt={2}
                          isLoading={isLoading} loadingText="Processando...">
                          Começar grátis
                        </Button>
                        <List spacing={2} pt={2} fontSize="sm" color="gray.600">
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="green.400" />
                            Cadastre propriedades
                          </ListItem>
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="green.400" />
                            Análise detalhada
                          </ListItem>
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="green.400" />
                            Sugestão de preço para todas
                          </ListItem>
                        </List>
                      </VStack>
                    </Box>

                    {/* Plano Mensal */}
                    <Box position="relative" borderRadius="xl" p={6} bg="white"
                      border="2px solid" borderColor="blue.400"
                      _hover={{ borderColor: 'blue.500', boxShadow: 'lg' }}
                      transition="all 0.3s" cursor="pointer"
                      onClick={() => handleCheckout('pro')}>
                      <Badge position="absolute" top={3} right={3} colorScheme="blue"
                        fontSize="0.75rem" px={2} py={0.5} borderRadius="full">
                        Mais popular
                      </Badge>
                      <VStack spacing={3} pt={4}>
                        <Text fontSize="lg" fontWeight="bold" color="gray.700">Plano Mensal</Text>
                        <Heading size="2xl" color="blue.500">Grátis</Heading>
                        <Text fontSize="sm" color="gray.400">/mês</Text>
                        <Button colorScheme="blue" size="md" w="100%" mt={2}
                          isLoading={isLoading} loadingText="Processando...">
                          Selecionar plano
                        </Button>
                        <List spacing={2} pt={2} fontSize="sm" color="gray.600">
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="blue.400" />
                            Cadastre propriedades
                          </ListItem>
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="blue.400" />
                            Análise detalhada
                          </ListItem>
                          <ListItem display="flex" alignItems="center">
                            <ListIcon as={CheckIcon} color="blue.400" />
                            Sugestão de preço para todas
                          </ListItem>
                        </List>
                      </VStack>
                    </Box>
                  </SimpleGrid>

                </VStack>
              </MotionBox>
            )}

          </AnimatePresence>
        </MotionBox>
      </Container>

      <ToastContainer position="top-right" />
    </Flex>
  );
}
