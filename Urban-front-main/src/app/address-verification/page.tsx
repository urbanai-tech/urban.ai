'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ToastContainer, toast } from 'react-toastify';

import { getUserAddresses, processAnalysesByProperty, registerAddresses, registerProcess, getUserManagedListingsWithCep } from '../service/api';
import { ConnectWithCep, CepValidation } from '../types/connect';



const MotionBox = motion(Box);

interface AddressForm {
  cep: string;
  number: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  propertyCep?: string; // CEP da propriedade para validação
  cepValidated?: boolean; // Se o CEP foi validado contra a propriedade
}

interface AddressItem {
  id: string;
  id_do_anuncio: string;
  titulo: string;
  pictureUrl: string;
  ativo: boolean;
  user?: { id: string };
  cep?: string; // CEP da propriedade
  endereco?: any; // Dados de endereço
  cepStatus?: string; // Status do CEP
  cepData?: any; // Dados da BrasilAPI
}

export default function AddressVerificationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AddressVerificationContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <Flex w="100%" minH="100vh" align="center" justify="center" bg="gray.100">
      <VStack spacing={4}>
        <Progress size="lg" isIndeterminate colorScheme="blue" />
        <Text fontSize="lg" color="gray.600">
          Carregando…
        </Text>
      </VStack>
    </Flex>
  );
}

// Componente AddressCard com imagem em círculo e campos na ordem correta
function AddressCard({
  title,
  imageUrl,
  cep,
  number,
  onCepChange,
  onNumberChange,
  isValid,
  validationMessage,
  onAddressUpdate,
}: {
  title: string;
  imageUrl: string;
  cep: string;
  number: string;
  onCepChange: (val: string) => void;
  onNumberChange: (val: string) => void;
  isValid: boolean;
  validationMessage: string | null;
  onAddressUpdate: (data: Pick<AddressForm, 'street' | 'neighborhood' | 'city' | 'state'>) => void;
}) {
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  // Busca automaticamente quando um CEP é pré-preenchido
  useEffect(() => {
    if (cep && cep.length >= 5 && !hasAutoSearched && !isLoadingCep) {
      console.log('🔍 Auto-buscando CEP:', cep);
      setHasAutoSearched(true);
      handleSearchCep();
    }
  }, [cep]); // Executa quando o CEP muda

  const handleSearchCep = async () => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      console.warn('⚠️ CEP inválido:', cleanedCep);
      setCepError('CEP inválido');
      return;
    }

    console.log('🌐 Buscando CEP no ViaCEP:', cleanedCep);
    setIsLoadingCep(true);
    setCepError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        console.warn('⚠️ CEP não encontrado:', cleanedCep);
        setCepError('CEP não encontrado');
        return;
      }

      console.log('✅ Dados do ViaCEP recebidos:', data);
      onAddressUpdate({
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar CEP:', error);
      setCepError('Falha ao buscar CEP');
      console.error('Erro na busca do CEP:', error);
    } finally {
      setIsLoadingCep(false);
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg={isValid ? 'blue.50' : 'white'}>
      <HStack align="start" spacing={4} flexDirection={{ base: 'column', md: 'row' }}>
        {/* Container circular para a imagem */}
        <Box
          flexShrink={0}
          w="80px"
          h="80px"
          borderRadius="full"
          overflow="hidden"
          position="relative"
          bg="gray.200"
        >
          <img
            src={imageUrl}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Box>

        <VStack align="stretch" flex={1} spacing={3}>
          <Text fontWeight="bold">{title}</Text>
          <HStack spacing={3} align="start" flexDirection={{ base: 'column', md: 'row' }}>
            {/* Campo CEP + Botão (agora primeiro) */}
            <Box flex={1}>
              <Text fontSize="sm" mb={1} color="gray.600">
                CEP
              </Text>
              <HStack spacing={2}>
                <input
                  value={cep}
                  onChange={(e) => onCepChange(e.target.value)}
                  placeholder="Digite o CEP"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: validationMessage === 'cep' || validationMessage === 'cep-mismatch' ? '#FFF5F5' : 'white',
                    borderColor: validationMessage === 'cep' || validationMessage === 'cep-mismatch' ? '#E53E3E' : '#e2e8f0',
                  }}
                />
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleSearchCep}
                  isLoading={isLoadingCep}
                >
                  Buscar
                </Button>
              </HStack>
              {(validationMessage === 'cep' || validationMessage === 'cep-mismatch' || cepError) && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {cepError || 
                   (validationMessage === 'cep-mismatch' ? 'CEP não corresponde ao da propriedade' : 'CEP inválido')}
                </Text>
              )}
            </Box>

            {/* Campo NÚMERO (agora segundo) */}
            <Box flex={1}>
              <Text fontSize="sm" mb={1} color="gray.600">
                Número
              </Text>
              <input
                value={number}
                onChange={(e) => onNumberChange(e.target.value)}
                placeholder="Número"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: validationMessage === 'number' ? '#FFF5F5' : 'white',
                  borderColor: validationMessage === 'number' ? '#E53E3E' : '#e2e8f0',
                }}
              />
              {validationMessage === 'number' && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  Número obrigatório
                </Text>
              )}
            </Box>
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}

function AddressVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressForms, setAddressForms] = useState<Record<string, AddressForm>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);

  useEffect(() => {
    setIsClient(true);

    async function loadUserAddresses() {
      setIsLoadingAddresses(true);

      const propertiesParam = searchParams.get('properties');
      if (propertiesParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(propertiesParam)) as AddressItem[];
          setAddresses(parsed);
          initializeAddressFormsWithData(parsed);
        } catch (error) {
          console.error('Erro ao parsear query params:', error);
        } finally {
          setIsLoadingAddresses(false);
        }
        return;
      }

      try {
        // Tenta usar a nova API com CEP validado
        try {
          // Usa 'me' para obter o usuário autenticado
          const userAddressesWithCep = await getUserManagedListingsWithCep('me');
          console.log('✅ Dados com CEP carregados:', userAddressesWithCep);
          
          if (userAddressesWithCep && userAddressesWithCep.length > 0) {
            const items: AddressItem[] = userAddressesWithCep.map((addr: any) => ({
              id: String(addr.id),
              id_do_anuncio: addr.id_do_anuncio,
              titulo: addr.titulo,
              pictureUrl: addr.pictureUrl,
              ativo: addr.ativo,
              user: addr.user,
              cep: addr.cep, // CEP da propriedade
              endereco: addr.endereco, // Dados de endereço
              cepStatus: addr.cepStatus, // Status validado
              cepData: addr.cepData, // Dados BrasilAPI
            }));
            console.log('✅ AddressItem mapeados:', items);
            setAddresses(items);
            initializeAddressFormsWithData(items);
            setIsLoadingAddresses(false);
            return;
          }
        } catch (cepError) {
          console.warn('⚠️ API com CEP não disponível, tentando API padrão:', cepError);
        }

        // Fallback para API padrão
        const userAddresses = await getUserAddresses();
        if (userAddresses && userAddresses.length > 0) {
          const items: AddressItem[] = userAddresses.map((addr: any) => ({
            id: String(addr.id),
            id_do_anuncio: addr.id_do_anuncio,
            titulo: addr.titulo,
            pictureUrl: addr.pictureUrl,
            ativo: addr.ativo,
            user: addr.user,
          }));
          setAddresses(items);
          initializeAddressForms(items);
        }
      } catch (error) {
        console.error('[ERRO] Carregar endereços do usuário:', error);
      } finally {
        setIsLoadingAddresses(false);
      }
    }

    loadUserAddresses();
  }, [searchParams]);

  // Inicializa formulários com dados da propriedade já preenchidos
  const initializeAddressFormsWithData = (items: AddressItem[]) => {
    console.log('🔧 Inicializando formulários com dados:', items);
    const initialForms = items.reduce(
      (acc, address) => ({
        ...acc,
        [address.id]: {
          cep: address.cep || '', // Preenche CEP da propriedade
          number: '',
          street: address.endereco?.logradouro || '',
          neighborhood: address.endereco?.bairro || '',
          city: address.endereco?.cidade || '',
          state: address.endereco?.estado || '',
          propertyCep: address.cep, // Guarda CEP da propriedade para validação
          cepValidated: false,
        },
      }),
      {} as Record<string, AddressForm>
    );
    console.log('✅ Formulários inicializados:', initialForms);
    setAddressForms(initialForms);
  };

  const initializeAddressForms = (items: AddressItem[]) => {
    const initialForms = items.reduce(
      (acc, address) => ({
        ...acc,
        [address.id]: {
          cep: '',
          number: '',
          street: '',
          neighborhood: '',
          city: '',
          state: '',
        },
      }),
      {} as Record<string, AddressForm>
    );
    setAddressForms(initialForms);
  };

  const updateAddressForm = (addressId: string, field: keyof AddressForm, value: string) => {
    setAddressForms((prev) => ({
      ...prev,
      [addressId]: {
        ...(prev[addressId] || { cep: '', number: '' }),
        [field]: value,
      },
    }));
  };

  const handleAddressUpdate = (
    addressId: string,
    data: Pick<AddressForm, 'street' | 'neighborhood' | 'city' | 'state'>
  ) => {
    setAddressForms((prev) => ({
      ...prev,
      [addressId]: {
        ...(prev[addressId] || { cep: '', number: '' }),
        ...data,
      },
    }));
  };

  const validateCep = (cep: string): boolean => {
    const digits = cep.replace(/\D/g, '');
    return /^\d{8}$/.test(digits);
  };

  /** Valida se o CEP do usuário corresponde ao da propriedade */
  const validateCepAgainstProperty = (addressId: string, userCep: string): boolean => {
    const form = addressForms[addressId];
    if (!form || !form.propertyCep) return false;
    
    const userCepClean = userCep.replace(/\D/g, '');
    const propertyCepClean = form.propertyCep.replace(/\D/g, '');
    
    return userCepClean === propertyCepClean;
  };

  const isFormValid = (addressId: string): boolean => {
    const f = addressForms[addressId];
    const cepMatchesProperty = validateCepAgainstProperty(addressId, f?.cep || '');
    
    return Boolean(
      f &&
      validateCep(f.cep) &&
      cepMatchesProperty && // NOVO: CEP deve corresponder ao da propriedade
      f.number &&
      f.street &&
      f.neighborhood &&
      f.city &&
      f.state
    );
  };

  const areAllFormsValid = (): boolean => addresses.every((address) => isFormValid(address.id));

  const getValidationMessage = (addressId: string): string | null => {
    const form = addressForms[addressId];
    if (!form || (!form.cep && !form.number)) return null;
    
    if (form.cep) {
      // Valida formato do CEP
      if (!validateCep(form.cep)) return 'cep';
      
      // NOVO: Valida se corresponde ao CEP da propriedade
      if (!validateCepAgainstProperty(addressId, form.cep)) return 'cep-mismatch';
    }
    
    if (form.number && form.number.length === 0) return 'number';
    return null;
  };

  const validAddressesCount = addresses.filter((addr) => isFormValid(addr.id)).length;
  const progressPercentage = addresses.length > 0 ? (validAddressesCount / addresses.length) * 100 : 0;

  const handleConfirmAll = async () => {
    if (!areAllFormsValid()) {
      toast("Preencha todos os campos corretamente antes de confirmar.", { type: "info" });
      return;
    }

    const confirmedAddresses = addresses.map((address) => {
      const f = addressForms[address.id];
      return {
        id: address.id,
        id_do_anuncio: address.id_do_anuncio,
        titulo: address.titulo,
        pictureUrl: address.pictureUrl,
        ativo: address.ativo,
        user: address.user,

        cep: f.cep,
        numero: f.number,
        logradouro: f.street,
        bairro: f.neighborhood,
        cidade: f.city,
        estado: f.state,

        list: { id: address.id },
      };
    });

    setIsLoading(true);
    try {
      await registerAddresses(confirmedAddresses);
      toast("Endereços confirmados com sucesso.", { type: "success" });
      try {
        const item = localStorage.getItem("registeredProperties");

        if (item) {
          const parsed = JSON.parse(item);
          const ids: any[] = parsed.map((item: { id: string }) => ({ id: item.id }));
          await registerProcess(ids);
        }

        toast("Análise iniciada.", { type: "success" });
      } catch (error) {
        console.error('Erro ao iniciar análise:', error);
      }

   setTimeout(() => {
  router.push('/dashboard');
}, 2000);

    } catch (error) {
      console.error('[ERRO] Confirmar endereços:', error);
      toast("Não foi possível confirmar os endereços", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isClient || isLoadingAddresses) {
    return (
      <Flex w="100%" minH="100vh" align="center" justify="center" bg="gray.100">
        <VStack spacing={4}>
          <Progress size="lg" isIndeterminate colorScheme="blue" />
          <Text fontSize="lg" color="gray.600">
            {isLoadingAddresses ? 'Carregando endereços…' : 'Carregando…'}
          </Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Flex w="100%" minH="100vh" align="center" justify="center" bg="gray.100" p={{ base: 4, md: 8 }}>
      <MotionBox
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        w={{ base: '100%', md: '80%' }}
        maxW="container.lg"
        bg="white"
        borderRadius="2xl"
        p={{ base: 6, md: 12 }}
      >
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" mb={3} color="gray.900">
              Verificação de Endereço
            </Heading>
            <Text fontSize="md" color="gray.700" fontWeight="medium">
              Confirme os endereços das propriedades selecionadas. Informe o CEP e o número de cada endereço.
            </Text>
            <Text fontSize="sm" mt={3} color="gray.500">
              Você pode confirmar todos de uma vez ou um por um.
            </Text>
          </Box>

          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium" color="gray.700">
                Progresso
              </Text>
              <Text fontSize="sm" color="gray.600">
                {`${validAddressesCount} de ${addresses.length} endereços válidos`}
              </Text>
            </HStack>
            <Progress value={progressPercentage} colorScheme="blue" size="sm" borderRadius="full" />
          </Box>

          <Divider />

          {addresses.length > 0 ? (
            <VStack spacing={6} align="stretch">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  title={address.titulo}
                  imageUrl={address.pictureUrl}
                  cep={addressForms[address.id]?.cep || ''}
                  number={addressForms[address.id]?.number || ''}
                  onCepChange={(val) => updateAddressForm(address.id, 'cep', val)}
                  onNumberChange={(val) => updateAddressForm(address.id, 'number', val)}
                  isValid={isFormValid(address.id)}
                  validationMessage={getValidationMessage(address.id)}
                  onAddressUpdate={(data) => handleAddressUpdate(address.id, data)}
                />
              ))}
            </VStack>
          ) : (
            <Alert status="info">
              <AlertIcon />
              <AlertDescription>Não há endereços para exibir.</AlertDescription>
            </Alert>
          )}

          {addresses.length > 0 && areAllFormsValid() && (
            <Alert status="success">
              <AlertIcon />
              <AlertDescription>Todos os endereços estão prontos para confirmação.</AlertDescription>
            </Alert>
          )}

          {addresses.length > 0 && (
            <HStack spacing={4} justify="center" flexWrap="wrap">
              <Button
                bg="#2E3748"
                color="white"
                size="lg"
                onClick={handleConfirmAll}
                isLoading={isLoading}
                loadingText="Confirmando…"
                minW="200px"
                isDisabled={!areAllFormsValid()}
              >
                Confirmar todos
              </Button>
            </HStack>
          )}
        </VStack>
      </MotionBox>
      <ToastContainer />
    </Flex>
  );
}
