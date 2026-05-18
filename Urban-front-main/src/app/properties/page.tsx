'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  IconButton,
  Stack,
  Center,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { AddIcon, CheckIcon, CloseIcon, DeleteIcon, EditIcon, ExternalLinkIcon, SearchIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';
import '../../../i18n';
import {
  getPropriedadesDropdownList,
  getPropertyPricingInputHistory,
  PricingInputHistory,
  PropertyDropdown,
  requestDeleteAddress,
  updatePropertyIdentity,
  updatePropertyPricingInputs,
} from '../service/api';
import { toast, ToastContainer } from 'react-toastify';
import { AddPropertyModal } from '../componentes/AddPropertyModal';

export default function MyProperties() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, { manualDailyPrice: string; averageMonthlyRevenue: string }>>({});
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, { internalNickname: string; internalCode: string }>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [pricingHistory, setPricingHistory] = useState<Record<string, PricingInputHistory[]>>({});
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);

  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await getPropriedadesDropdownList();
      setProperties(data);
      setPricingDrafts(Object.fromEntries(data.map((prop) => [
        prop.id,
        {
          manualDailyPrice: prop.manualDailyPrice ? String(prop.manualDailyPrice) : '',
          averageMonthlyRevenue: prop.averageMonthlyRevenue ? String(prop.averageMonthlyRevenue) : '',
        },
      ])));
      setIdentityDrafts(Object.fromEntries(data.map((prop) => [
        prop.id,
        {
          internalNickname: prop.internalNickname ?? '',
          internalCode: prop.internalCode ?? '',
        },
      ])));
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleDeleteRequest = (id: string) => {
    setPropertyToDelete(id);
    onOpen();
  };

  const confirmDelete = async () => {
    if (!propertyToDelete) return;
    
    try {
      await requestDeleteAddress(propertyToDelete);
      toast("Propriedade excluída", { type: "success" });
      setProperties((prev) => prev.filter((prop) => prop.id !== propertyToDelete));
    } catch (error) {
      toast("Erro ao excluir propriedade", { type: "error" });
      console.error('Erro ao deletar imóvel:', error);
    } finally {
      onClose();
      setPropertyToDelete(null);
    }
  };

  const handleAddProperty = () => {
    onAddOpen();
  };

  const updateDraft = (id: string, field: 'manualDailyPrice' | 'averageMonthlyRevenue', value: string) => {
    setPricingDrafts((prev) => ({
      ...prev,
      [id]: {
        manualDailyPrice: prev[id]?.manualDailyPrice ?? '',
        averageMonthlyRevenue: prev[id]?.averageMonthlyRevenue ?? '',
        [field]: value,
      },
    }));
  };

  const updateIdentityDraft = (id: string, field: 'internalNickname' | 'internalCode', value: string) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [id]: {
        internalNickname: prev[id]?.internalNickname ?? '',
        internalCode: prev[id]?.internalCode ?? '',
        [field]: value,
      },
    }));
  };

  const editIdentity = (prop: PropertyDropdown) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [prop.id]: {
        internalNickname: prop.internalNickname ?? '',
        internalCode: prop.internalCode ?? '',
      },
    }));
    setEditingIdentity(prop.id);
  };

  const cancelIdentityEdit = (prop: PropertyDropdown) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [prop.id]: {
        internalNickname: prop.internalNickname ?? '',
        internalCode: prop.internalCode ?? '',
      },
    }));
    setEditingIdentity(null);
  };

  const parseMoney = (value: string) => {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const saveIdentity = async (prop: PropertyDropdown) => {
    const draft = identityDrafts[prop.id] ?? { internalNickname: '', internalCode: '' };
    const internalNickname = draft.internalNickname.trim() || null;
    const internalCode = draft.internalCode.trim() || null;

    try {
      setSavingIdentity(prop.id);
      const updated = await updatePropertyIdentity(prop.id, {
        internalNickname,
        internalCode,
      });
      setProperties((prev) => prev.map((item) => item.id === prop.id ? { ...item, ...updated } : item));
      setEditingIdentity(null);
      toast("Identificacao do imovel salva.", { type: "success" });
    } catch (error) {
      toast("Erro ao salvar apelido/codigo do imovel.", { type: "error" });
      console.error('Erro ao salvar identificacao do imovel:', error);
    } finally {
      setSavingIdentity(null);
    }
  };

  const savePricingInputs = async (prop: PropertyDropdown) => {
    const draft = pricingDrafts[prop.id] ?? { manualDailyPrice: '', averageMonthlyRevenue: '' };
    const manualDailyPrice = parseMoney(draft.manualDailyPrice);

    if (!manualDailyPrice) {
      toast("Informe uma diária base válida para este imóvel.", { type: "warning" });
      return;
    }

    try {
      setSavingPricing(prop.id);
      const updated = await updatePropertyPricingInputs(prop.id, {
        manualDailyPrice,
        averageMonthlyRevenue: parseMoney(draft.averageMonthlyRevenue),
      });
      setProperties((prev) => prev.map((item) => item.id === prop.id ? { ...item, ...updated } : item));
      setPricingHistory((prev) => {
        const next = { ...prev };
        delete next[prop.id];
        return next;
      });
      toast("Preço base salvo. As próximas análises usarão este valor.", { type: "success" });
    } catch (error) {
      toast("Erro ao salvar preço base do imóvel.", { type: "error" });
      console.error('Erro ao salvar inputs de pricing:', error);
    } finally {
      setSavingPricing(null);
    }
  };

  const loadPricingHistory = async (propId: string) => {
    if (openHistory === propId) {
      setOpenHistory(null);
      return;
    }

    setOpenHistory(propId);
    if (pricingHistory[propId]) return;

    try {
      setLoadingHistory(propId);
      const history = await getPropertyPricingInputHistory(propId, 10);
      setPricingHistory((prev) => ({ ...prev, [propId]: history }));
    } catch (error) {
      toast("Erro ao carregar histórico de preço.", { type: "error" });
      console.error('Erro ao carregar histórico de inputs de pricing:', error);
    } finally {
      setLoadingHistory(null);
    }
  };

  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getAirbnbRoomUrl = (listingId?: string | null) => {
    const value = listingId?.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://www.airbnb.com/rooms/${encodeURIComponent(value)}`;
  };

  const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const normalizeSearch = (value: unknown) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const searchNeedle = normalizeSearch(propertySearch);
  const filteredProperties = properties.filter((prop) => {
    if (!searchNeedle) return true;
    return [
      prop.internalNickname,
      prop.internalCode,
      prop.propertyName,
      prop.id_do_anuncio,
      prop.id,
      (prop as any).neighborhood,
      (prop as any).city,
      (prop as any).address,
    ].some((value) => normalizeSearch(value).includes(searchNeedle));
  });

  // Local: thumb com fallback. Evita imagem quebrada com alt text exposto
  // (bug capturado no screenshot host-propriedades.png da auditoria 2026-05-16).
  function PropertyThumb({ src, alt }: { src?: string | null; alt: string }) {
    const [errored, setErrored] = useState(false);
    const initial = (alt?.charAt(0) || '?').toUpperCase();
    if (!src || errored) {
      return (
        <Flex
          boxSize="60px"
          borderRadius="md"
          bg="gray.100"
          borderWidth="1px"
          borderColor="gray.200"
          align="center"
          justify="center"
          fontWeight="bold"
          color="gray.500"
          fontSize="lg"
          flexShrink={0}
        >
          {initial}
        </Flex>
      );
    }
    return (
      <Image
        src={src}
        alt={alt}
        boxSize="60px"
        objectFit="cover"
        borderRadius="md"
        flexShrink={0}
        onError={() => setErrored(true)}
      />
    );
  }

  if (loading) {
    return (
      <Center height="300px">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box w="full" mx="auto" px={{ base: 4, md: 6 }} py={8} bg="white" borderRadius="md" shadow="sm">
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', sm: 'center' }}
        gap={4}
        mb={6}
      >
        <Heading size="lg">{t('my_properties.title')}</Heading>
        <Button
          leftIcon={<AddIcon />}
          variant="outline"
          size="sm"
          alignSelf={{ base: 'flex-start', sm: 'auto' }}
          onClick={handleAddProperty}
        >
          {t('my_properties.add_property')}
        </Button>
      </Flex>

      <Flex
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'stretch', md: 'center' }}
        justify="space-between"
        gap={3}
        mb={5}
      >
        <InputGroup maxW={{ base: 'full', md: '520px' }}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" boxSize={3.5} />
          </InputLeftElement>
          <Input
            value={propertySearch}
            onChange={(event) => setPropertySearch(event.target.value)}
            placeholder="Filtrar por apelido, codigo, titulo ou ID Airbnb"
            bg="white"
            borderColor="gray.200"
            size="sm"
            pl={9}
          />
        </InputGroup>
        <Flex align="center" gap={2} justify={{ base: 'space-between', md: 'flex-end' }}>
          <Text fontSize="sm" color="gray.500">
            {filteredProperties.length} de {properties.length} imoveis
          </Text>
          {propertySearch && (
            <IconButton
              aria-label="Limpar filtro"
              icon={<CloseIcon />}
              size="xs"
              variant="ghost"
              color="gray.500"
              onClick={() => setPropertySearch('')}
            />
          )}
        </Flex>
      </Flex>

      <Stack spacing={4} mb={4}>
        {filteredProperties.map((prop) => {
          const airbnbUrl = getAirbnbRoomUrl(prop.id_do_anuncio);
          const isEditingIdentity = editingIdentity === prop.id;
          const identityDraft = identityDrafts[prop.id] ?? { internalNickname: '', internalCode: '' };
          const locationLabel = (prop as any).neighborhood || (prop as any).city || (prop as any).address || 'Imovel cadastrado';
          const secondaryLabel = prop.internalNickname ? prop.propertyName : locationLabel;
          const detailLabel = [
            prop.id_do_anuncio ? `Airbnb ${prop.id_do_anuncio}` : null,
            prop.internalNickname ? locationLabel : null,
          ].filter(Boolean).join(' - ');

          return (
          <Box key={prop.id} borderBottom="1px solid" borderColor="gray.100">
          <Flex
            align={{ base: 'stretch', md: 'center' }}
            justify="space-between"
            direction={{ base: 'column', md: 'row' }}
            gap={4}
            p={3}
            borderRadius="md"
            _hover={{ bg: 'gray.50' }}
          >
            <Flex align="center">
              <PropertyThumb src={prop.image_url} alt={prop.propertyName} />
              <Box ml={4} minW={0} flex="1">
                {isEditingIdentity ? (
                  <Stack spacing={2} maxW={{ base: 'full', md: '460px' }}>
                    <Flex gap={2} direction={{ base: 'column', sm: 'row' }}>
                      <Input
                        size="sm"
                        placeholder="Apelido interno"
                        maxLength={80}
                        value={identityDraft.internalNickname}
                        onChange={(event) => updateIdentityDraft(prop.id, 'internalNickname', event.target.value)}
                      />
                      <Input
                        size="sm"
                        placeholder="Codigo"
                        maxLength={32}
                        value={identityDraft.internalCode}
                        onChange={(event) => updateIdentityDraft(prop.id, 'internalCode', event.target.value)}
                        w={{ base: 'full', sm: '140px' }}
                      />
                    </Flex>
                    <Flex gap={2}>
                      <Button
                        size="xs"
                        leftIcon={<CheckIcon />}
                        colorScheme="green"
                        isLoading={savingIdentity === prop.id}
                        onClick={() => saveIdentity(prop)}
                      >
                        Salvar ID
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<CloseIcon />}
                        onClick={() => cancelIdentityEdit(prop)}
                      >
                        Cancelar
                      </Button>
                    </Flex>
                  </Stack>
                ) : (
                  <>
                    <Flex align="center" gap={2} wrap="wrap">
                      <Text fontWeight="medium" noOfLines={1}>
                        {prop.internalNickname || prop.propertyName}
                      </Text>
                      {prop.internalCode && (
                        <Text
                          as="span"
                          fontSize="2xs"
                          color="gray.600"
                          bg="gray.100"
                          borderRadius="md"
                          px={2}
                          py={0.5}
                          fontWeight="semibold"
                        >
                          {prop.internalCode}
                        </Text>
                      )}
                      <IconButton
                        aria-label="Editar apelido e codigo do imovel"
                        icon={<EditIcon />}
                        size="xs"
                        variant="ghost"
                        color="gray.500"
                        onClick={() => editIdentity(prop)}
                      />
                    </Flex>
                    <Text fontSize="sm" color="gray.500" noOfLines={1}>
                      {secondaryLabel}
                    </Text>
                    {detailLabel && (
                      <Text fontSize="xs" color="gray.400" noOfLines={1}>
                        {detailLabel}
                      </Text>
                    )}
                  </>
                )}
              </Box>
            </Flex>
            <Flex
              align={{ base: 'stretch', md: 'flex-end' }}
              gap={3}
              direction={{ base: 'column', md: 'row' }}
            >
              <Box>
                <Text
                  fontSize="2xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="gray.500"
                  fontWeight="semibold"
                  mb={1}
                >
                  Diária base
                </Text>
                <Flex
                  align="center"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  pl={2}
                  bg="white"
                  w={{ base: 'full', md: '160px' }}
                  _focusWithin={{ borderColor: 'blue.500' }}
                >
                  <Text fontSize="sm" color="gray.500" mr={1}>R$</Text>
                  <Input
                    size="sm"
                    border="none"
                    pl={0}
                    placeholder="0,00"
                    inputMode="decimal"
                    value={pricingDrafts[prop.id]?.manualDailyPrice ?? ''}
                    onChange={(event) => updateDraft(prop.id, 'manualDailyPrice', event.target.value)}
                  />
                </Flex>
              </Box>
              <Box>
                <Text
                  fontSize="2xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="gray.500"
                  fontWeight="semibold"
                  mb={1}
                >
                  Receita média / mês
                </Text>
                <Flex
                  align="center"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  pl={2}
                  bg="white"
                  w={{ base: 'full', md: '180px' }}
                  _focusWithin={{ borderColor: 'blue.500' }}
                >
                  <Text fontSize="sm" color="gray.500" mr={1}>R$</Text>
                  <Input
                    size="sm"
                    border="none"
                    pl={0}
                    placeholder="0,00"
                    inputMode="decimal"
                    value={pricingDrafts[prop.id]?.averageMonthlyRevenue ?? ''}
                    onChange={(event) => updateDraft(prop.id, 'averageMonthlyRevenue', event.target.value)}
                  />
                </Flex>
              </Box>
              <Flex gap={2} align="center" mt={{ base: 2, md: 5 }}>
                <Button
                  size="sm"
                  bg="#E8500A"
                  color="white"
                  borderRadius="10px"
                  fontWeight="600"
                  letterSpacing="0.2px"
                  _hover={{ bg: '#D14609' }}
                  _active={{ bg: '#C04209' }}
                  _focus={{ boxShadow: '0 0 0 3px rgba(232, 80, 10, 0.30)' }}
                  isLoading={savingPricing === prop.id}
                  onClick={() => savePricingInputs(prop)}
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  color="gray.600"
                  isLoading={loadingHistory === prop.id}
                  onClick={() => loadPricingHistory(prop.id)}
                >
                  Histórico
                </Button>
                {airbnbUrl ? (
                  <Button
                    as="a"
                    href={airbnbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="ghost"
                    color="gray.600"
                    leftIcon={<ExternalLinkIcon />}
                  >
                    Abrir
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    color="gray.400"
                    leftIcon={<ExternalLinkIcon />}
                    isDisabled
                  >
                    Abrir
                  </Button>
                )}
                <IconButton
                  aria-label={t('my_properties.delete')}
                  icon={<DeleteIcon />}
                  variant="ghost"
                  color="red.600"
                  size="sm"
                  onClick={() => handleDeleteRequest(prop.id)}
                />
              </Flex>
            </Flex>
          </Flex>

          {/* Detalhes técnicos (lat/lng) — colapsado em <details> nativo */}
          <Box px={3} pb={2}>
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                Detalhes técnicos
              </summary>
              <Text fontSize="xs" color="gray.500" mt={1} fontFamily="monospace">
                Latitude {prop.latitude} · Longitude {prop.longitude}
              </Text>
            </details>
          </Box>
          {openHistory === prop.id && (
            <Box px={3} pb={3}>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Últimas alterações de preço base
              </Text>
              {(pricingHistory[prop.id] ?? []).length === 0 ? (
                <Text fontSize="sm" color="gray.500">
                  Nenhuma alteração registrada ainda.
                </Text>
              ) : (
                <Stack spacing={2}>
                  {pricingHistory[prop.id].map((item) => (
                    <Flex
                      key={item.id}
                      justify="space-between"
                      gap={3}
                      direction={{ base: 'column', md: 'row' }}
                      fontSize="sm"
                      color="gray.700"
                    >
                      <Text color="gray.500">{formatDateTime(item.createdAt)}</Text>
                      <Text>
                        Diária {formatMoney(item.previousManualDailyPrice)} -&gt; {formatMoney(item.newManualDailyPrice)}
                      </Text>
                      <Text>
                        Mês {formatMoney(item.previousAverageMonthlyRevenue)} -&gt; {formatMoney(item.newAverageMonthlyRevenue)}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Box>
          )}
          </Box>
          );
        })}
      </Stack>

      {properties.length > 0 && filteredProperties.length === 0 && (
        <Box borderWidth="1px" borderColor="gray.100" borderRadius="md" p={6} textAlign="center">
          <Text color="gray.500" fontSize="sm">
            Nenhum imovel encontrado para esse filtro.
          </Text>
        </Box>
      )}

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="12px">
            <AlertDialogHeader fontSize="lg" fontWeight="600">
              Excluir propriedade?
            </AlertDialogHeader>

            <AlertDialogBody color="gray.600">
              O motor de IA não atualizará mais os preços desta unidade.
              Esta ação não pode ser desfeita.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} variant="ghost">
                Cancelar
              </Button>
              <Button
                bg="red.600"
                color="white"
                _hover={{ bg: 'red.700' }}
                onClick={confirmDelete}
                ml={3}
              >
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AddPropertyModal 
        isOpen={isAddOpen} 
        onClose={onAddClose} 
        onSuccess={fetchProperties} 
      />

      <ToastContainer />
    </Box>
  );
}
