'use client';

import React, { useState, useEffect } from 'react';
import {
  Flex, VStack, Box, Heading, Text, Input,
  FormControl, FormLabel, Switch, Stack,
  Button, Spinner
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import '../../../i18n';
import { getHostId, getUserManagedListings, registerProperties, registerAddresses, createMultipleAddresses, resolveAirbnbUrl } from '../service/api';
import { ToastContainer, toast } from 'react-toastify';
import ReactPlayer from "react-player";
import { QuestionIcon, CloseIcon } from '@chakra-ui/icons';

const MotionBox = motion(Box);

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

export default function ConectarAirbnb() {
  const { t, ready } = useTranslation();
  const router = useRouter();

  const [airbnbLink, setAirbnbLink] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<SelectedPropertiesState>({});
  const [selectAll, setSelectAll] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    console.log(t('not_member'), ready);
  }, [ready, t]);

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
    } catch (error) {
      console.error('Erro ao extrair ID do Airbnb:', error);
      return null;
    }
  };

  const initializeSelectedProperties = (list: Property[]) => {
    const initialSelectedState: SelectedPropertiesState = {};
    list.forEach(prop => {
      initialSelectedState[prop.id_do_anuncio] = prop.ativo;
    });
    setSelectedProperties(initialSelectedState);
    setSelectAll(list.length > 0 && list.every(p => p.ativo));
  };

  const fetchUserProperties = async () => {
    setIsLoading(true);
    try {
      const result = await resolveAirbnbUrl(airbnbLink);
      setAirbnbLink(result.finalUrl);

      const id = extractAirbnbListingId(airbnbLink);
      let urlEditor = null;
      if (id) {
        const newUrl = `https://www.airbnb.com/rooms/${id}`;
        urlEditor = newUrl;
      }

      const propertyIdExtracted = extractAirbnbPropertyId(urlEditor ? urlEditor : result.finalUrl);

      let userIdFromGetHostId = null;
      if (propertyIdExtracted) {
        const data = await getHostId(propertyIdExtracted);
        userIdFromGetHostId = data?.result.hostId;
      }

      let userId = userIdFromGetHostId || extractAirbnbUserId(urlEditor ? urlEditor : result.finalUrl);

      if (!userId) {
        toast("Por favor, insira um link válido do perfil do Airbnb.", { type: "error" });
        setIsLoading(false);
        return;
      }

      const listings = await getUserManagedListings(userId);

      const mappedProperties: Property[] = listings.map((item: any) => ({
        id: item.id || 0,
        titulo: item.titulo ?? item.name ?? 'Sem título',
        id_do_anuncio: item.id_do_anuncio ?? '',
        ativo: false,
        pictureUrl: item.pictureUrl ?? '',
      }));

      setProperties(mappedProperties);
      initializeSelectedProperties(mappedProperties);
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
      toast("Não foi possível buscar seus imóveis. Tente novamente mais tarde.", { type: "error" });
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
      toast("Por favor, selecione pelo menos uma propriedade.", { type: "error" });
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

      // Passo 1: Registra as propriedades
      const response = await registerProperties(toRegister);
      const registered: RegisteredProperty[] = Array.isArray((response as any)?.data)
        ? (response as any).data
        : (response as any);

      if (Array.isArray(registered)) {
        localStorage.setItem('registeredProperties', JSON.stringify(registered));
      }

      // Passo 2: Cria endereços usando endpoint correto
      // Valida estado para ter máximo 2 caracteres (UF)
      const addressesToRegister = registered.map((prop: any) => {
        const estado = 'A definir';
        return {
          cep: '00000-000', // CEP padrão (sem validação)
          numero: 'S/N', // Sem número
          logradouro: 'A definir',
          bairro: 'A definir',
          cidade: 'A definir',
          estado: estado.length > 2 ? estado.substring(0, 2) : null, // ✅ Trunca para 2 ou null
          list: { 
            id: prop.id_do_anuncio // ✅ Usa id_do_anuncio conforme guia
          },
        };
      });

      await createMultipleAddresses(addressesToRegister);
      
      toast("Propriedades registradas com sucesso!", { type: "success" });

      // Redireciona direto para dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Erro ao registrar propriedades:', error);
      toast("Falha ao registrar propriedades. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex w="100%" minH="90vh" align="center" justify="center" bg="gray.100" p={{ base: 4, md: 8 }}>
      <MotionBox
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        w={{ base: '100%', md: '70%' }}
        maxW="container.lg"
        bg="white"
        borderRadius="2xl"
        p={{ base: 6, md: 12 }}
      >
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" mb={3}>Connect seu Perfil</Heading>
          </Box>

          {/* Botão e área do tutorial */}
          <Box textAlign="center" mb={6}>
            <Button
              leftIcon={showTutorial ? <CloseIcon boxSize={3} /> : <QuestionIcon boxSize={4} />}
              variant="solid"
              colorScheme={showTutorial ? "red" : "blue"}
              onClick={() => setShowTutorial(!showTutorial)}
              size="sm"
              borderRadius="full"
              px={5}
              py={2}
              boxShadow="sm"
            >
              {showTutorial ? 'Fechar ajuda' : 'Preciso de ajuda'}
            </Button>

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={showTutorial ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              style={{ overflow: 'hidden' }}
            >
              {showTutorial && (
                <Box mt={4}>
                  <Box
                    position="relative"
                    borderRadius="xl"
                    overflow="hidden"
                    boxShadow="md"
                    bg="black"
                    pt="56.25%"
                  >
                    {!isIframeLoaded && (
                      <Flex
                        position="absolute"
                        inset={0}
                        bg="blackAlpha.700"
                        alignItems="center"
                        justifyContent="center"
                        zIndex={1}
                      >
                        <Spinner size="xl" color="white" />
                      </Flex>
                    )}

                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      width="100%"
                      height="100%"
                    >
                      <div className="relative w-full aspect-video bg-black overflow-hidden md:rounded-lg">
                        <ReactPlayer
                          src={"https://vimeo.com/1126884738"}
                          width="100%"
                          height="100%"
                          controls
                          playing={showTutorial}
                          onReady={() => setIsIframeLoaded(true)}
                          style={{ position: "absolute", top: 0, left: 0, objectFit: "contain" }}
                        />
                      </div>
                    </Box>
                  </Box>
                  <Text fontSize="sm" mt={2} color="gray.500">
                    {t('tutorial_description', 'Assista a este breve tutorial para aprender como usar o AI-Urban')}
                  </Text>
                </Box>
              )}
            </motion.div>
          </Box>

          {/* Campo de link do Airbnb */}
          <FormControl>
            <FormLabel fontSize="md" fontWeight="medium">
              {t('airbnb_profile_link', 'Link do Perfil do Airbnb ou Link do anúncio')}
            </FormLabel>
            <Input
              size="lg"
              type="text"
              placeholder="https://www.airbnb.com.br/users/show/123456789"
              value={airbnbLink}
              onChange={(e) => setAirbnbLink(e.target.value)}
              focusBorderColor="blue.500"
            />
            <Text fontSize="xs" mt={1} color="gray.500">
              {t('airbnb_profile_link_example', 'Exemplo: {{example}}', { example: 'https://www.airbnb.com.br/users/show/155326952 ou https://www.airbnb.com.br/rooms/645183585737605838?' })}
            </Text>
          </FormControl>

          <Button
            bg="#2E3748"
            color="white"
            _hover={{ bg: '#252E3E' }}
            _active={{ bg: '#1B2330' }}
            size="lg"
            isLoading={isLoading}
            loadingText={t('searching_properties', 'Buscando...')}
            onClick={fetchUserProperties}
          >
            Buscar propriedades
          </Button>

          {properties.length > 0 && (
            <Box>
              <Text fontSize="md" mb={4} fontWeight="semibold">
                {'Encontramos suas propriedades, por favor selecione as que deseja registrar'}
              </Text>

              <FormControl
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                bg="gray.50"
                p={3}
                borderRadius="md"
                mb={3}
              >
                <FormLabel mb="0" fontWeight="semibold">
                  {t('select_all_listings', 'Selecionar todos os anúncios')}
                </FormLabel>
                <Switch
                  colorScheme="blue"
                  isChecked={selectAll}
                  onChange={handleSelectAllToggle}
                />
              </FormControl>

              <Stack spacing={3} maxH="400px" overflowY="auto" pr={2}>
                {properties.map((property) => (
                  <FormControl
                    key={property.id_do_anuncio}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    bg="white"
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'blue.400' }}
                  >
                    <FormLabel mb="0" fontWeight="medium">{property.titulo}</FormLabel>
                    <Switch
                      colorScheme="blue"
                      isChecked={selectedProperties[property.id_do_anuncio] || false}
                      onChange={() => handlePropertyToggle(property.id_do_anuncio)}
                    />
                  </FormControl>
                ))}
              </Stack>
            </Box>
          )}

          <Button
            bg="#2E3748"
            color="white"
            _hover={{ bg: '#252E3E' }}
            _active={{ bg: '#1B2330' }}
            size="lg"
            onClick={handleRegisterProperties}
            isDisabled={properties.length === 0 || Object.values(selectedProperties).every(val => val === false)}
            isLoading={isLoading}
            loadingText="Registrando e direcionando..."
          >
            {t('register_properties', 'Registrar propriedades')}
          </Button>
        </VStack>
      </MotionBox>
      <ToastContainer />
    </Flex>
  );
}
