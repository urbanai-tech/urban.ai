'use client';

import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  VStack,
  Text,
  Box,
  Flex,
  Image,
  Checkbox,
  Spinner,
  Badge
} from '@chakra-ui/react';
import { toast } from 'react-toastify';
import {
  getUserManagedListings,
  getPropriedadesDropdownList,
  registerProperties,
  resolveAirbnbUrl,
  getPropertyQuickInfo
} from '../service/api';
import { useTranslation } from 'react-i18next';

export interface Property {
  id: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
  pictureUrl?: string;
  propertyType?: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  guests?: number;
  rating?: number;
  isNewListing?: boolean;
  reviewCount?: number;
  neighborhood?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  fullAddress?: string;
  amenitiesCount?: number;
  amenities?: string[];
}

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPropertyModal({ isOpen, onClose, onSuccess }: AddPropertyModalProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedProperties, setFetchedProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, boolean>>({});

  const resetState = () => {
    setInputValue('');
    setFetchedProperties([]);
    setSelectedProperties({});
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Helper patterns extractors
  const extractAirbnbPropertyId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const patterns = [/\/rooms\/(\d+)/, /rooms\/([a-zA-Z0-9]+)/];
    for (const pattern of patterns) {
      const match = link.split('?')[0].match(pattern);
      if (match && match[1]) return match[1].split('/')[0];
    }
    return null;
  };

  const extractAirbnbUserId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const regex = /\/users\/(?:show|profile)\/(\d+)/;
    const match = link.match(regex);
    return match && match[1] ? match[1] : null;
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

  const handleFetchProperties = async () => {
    if (!inputValue.trim()) {
      toast("Por favor, insira o link de um imóvel ou do perfil Airbnb.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    setFetchedProperties([]);

    try {
      const existingProps = await getPropriedadesDropdownList();
      const existingIds = existingProps.map(p => p.id_do_anuncio).filter(Boolean);

      let finalUrl = inputValue.trim();
      let isProfileLink = false;

      // Handle shortened URLs
      if (finalUrl.includes('airbnb.com/h/') || finalUrl.includes('abnb.me')) {
        try {
          const resolved = await resolveAirbnbUrl(finalUrl);
          finalUrl = resolved.finalUrl;
        } catch { }
      }

      // Handle host/editor links vs property links
      const userId = extractAirbnbUserId(finalUrl);
      if (userId) {
        isProfileLink = true;
        const listings = await getUserManagedListings(userId);

        if (!listings || listings.length === 0) {
          toast("Não encontramos imóveis neste perfil.", { type: "warning" });
          setIsLoading(false);
          return;
        }

        const filteredListings = listings.filter((item: any) => !existingIds.includes(item.id_do_anuncio));
        
        if (filteredListings.length === 0) {
          toast("Todos os imóveis deste perfil já estão cadastrados em sua conta.", { type: "info" });
          setIsLoading(false);
          return;
        }

        const mapped: Property[] = filteredListings.map((item: any) => ({
          id: item.id || 0,
          titulo: item.titulo ?? item.name ?? 'Sem título',
          id_do_anuncio: item.id_do_anuncio ?? '',
          ativo: true,
          pictureUrl: item.pictureUrl,
          bedrooms: item.bedrooms || 0,
          beds: item.beds || 0,
          bathrooms: item.bathrooms || 0,
          guests: item.personCapacity || item.guests || 0,
          rating: item.rating || 0,
          propertyType: item.propertyType || '',
          city: item.city || '',
        }));

        setFetchedProperties(mapped);
        const autoSelect: Record<string, boolean> = {};
        mapped.forEach(p => { autoSelect[p.id_do_anuncio] = true; });
        setSelectedProperties(autoSelect);
        setIsLoading(false);
        return;
      }

      // It's a single property link
      let propertyId = extractAirbnbPropertyId(finalUrl);
      const editorId = extractAirbnbListingId(finalUrl);
      if (editorId) {
        propertyId = editorId;
      }

      if (!propertyId) {
        toast("Não foi possível identificar o ID do imóvel no link fornecido.", { type: "error" });
        setIsLoading(false);
        return;
      }

      if (existingIds.includes(propertyId)) {
        toast("Este imóvel já está cadastrado em sua conta.", { type: "info" });
        setIsLoading(false);
        return;
      }

      const info = await getPropertyQuickInfo(propertyId);
      const newProp: Property = {
        id: 0,
        titulo: info.title,
        id_do_anuncio: propertyId,
        ativo: true,
        pictureUrl: info.pictureUrl,
        bedrooms: info.bedrooms || 0,
        beds: info.beds || 0,
        bathrooms: info.bathrooms || 0,
        guests: info.guests || 0,
        rating: info.rating || 0,
        propertyType: info.propertyType || '',
      };

      setFetchedProperties([newProp]);
      setSelectedProperties({ [newProp.id_do_anuncio]: true });
      
    } catch (error) {
      console.error(error);
      toast("Ocorreu um erro ao buscar o(s) imóvel(is).", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProperty = (id: string, checked: boolean) => {
    setSelectedProperties(prev => ({ ...prev, [id]: checked }));
  };

  const handleSaveProperties = async () => {
    const selectedList = fetchedProperties.filter(p => selectedProperties[p.id_do_anuncio]);
    if (selectedList.length === 0) {
      toast("Selecione pelo menos um imóvel para adicionar.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      const payload = selectedList.map(p => ({ ...p, ativo: true }));
      await registerProperties(payload as any);
      toast(`${selectedList.length} propriedade(s) registrada(s) com sucesso!`, { type: "success" });
      onSuccess(); // Trigger parent refresh
      handleClose();
    } catch (error) {
      console.error(error);
      toast("Erro ao registrar as propriedades.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="xl" fontWeight="bold">Adicionar Imóvel</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody pb={6}>
          {fetchedProperties.length === 0 ? (
            <VStack spacing={4} align="stretch">
              <Text color="gray.600">
                Para adicionar propriedades à sua conta, cole abaixo o <strong>Link do Airbnb</strong> do seu imóvel ou o <strong>link do seu perfil de Anfitrião</strong> (para importar automaticamente todos os imóveis).
              </Text>
              
              <Input
                placeholder="Exemplo: https://www.airbnb.com/rooms/12345678"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                size="lg"
                isDisabled={isLoading}
              />
              
              <Button 
                colorScheme="blue" 
                size="lg" 
                onClick={handleFetchProperties}
                isLoading={isLoading}
                loadingText="Buscando..."
                mt={2}
              >
                Buscar Prorpiedades
              </Button>
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              <Text fontWeight="medium" mb={2}>
                Encontramos {fetchedProperties.length} imóvel(is) elegível(is). Selecione os que deseja monitorar e atualizar:
              </Text>

              <Box maxH="400px" overflowY="auto" borderRadius="md" border="1px solid" borderColor="gray.200" p={2}>
                <VStack spacing={3} align="stretch">
                  {fetchedProperties.map((prop) => (
                    <Flex 
                      key={prop.id_do_anuncio} 
                      p={3} 
                      borderWidth="1px" 
                      borderRadius="lg" 
                      alignItems="center"
                      bg={selectedProperties[prop.id_do_anuncio] ? 'blue.50' : 'white'}
                      borderColor={selectedProperties[prop.id_do_anuncio] ? 'blue.200' : 'gray.200'}
                      transition="all 0.2s"
                      _hover={{ borderColor: 'blue.300', transform: 'translateY(-1px)', shadow: 'sm' }}
                      cursor="pointer"
                      onClick={() => handleToggleProperty(prop.id_do_anuncio, !selectedProperties[prop.id_do_anuncio])}
                    >
                      <Checkbox 
                        isChecked={selectedProperties[prop.id_do_anuncio] || false}
                        onChange={(e) => handleToggleProperty(prop.id_do_anuncio, e.target.checked)}
                        colorScheme="blue"
                        size="lg"
                        mr={4}
                        pointerEvents="none"
                      />
                      
                      {prop.pictureUrl ? (
                        <Image 
                          src={prop.pictureUrl} 
                          alt="Capa" 
                          boxSize="70px" 
                          objectFit="cover" 
                          borderRadius="md" 
                          mr={4} 
                        />
                      ) : (
                        <Box boxSize="70px" bg="gray.100" borderRadius="md" mr={4} display="flex" alignItems="center" justifyContent="center">
                          <Text color="gray.400" fontSize="xs">Sem foto</Text>
                        </Box>
                      )}
                      
                      <Box flex="1">
                        <Text fontWeight="semibold" noOfLines={1} fontSize="md">{prop.titulo || `Anúncio #${prop.id_do_anuncio}`}</Text>
                        <Text color="gray.500" fontSize="sm" mt={1}>
                          {prop.propertyType || 'Inteiro'} • {prop.guests} hóspedes {prop.bedrooms ? `• ${prop.bedrooms} quartos` : ''} {prop.beds ? `• ${prop.beds} leitos` : ''} {prop.bathrooms ? `• ${prop.bathrooms} banheiros` : ''}
                        </Text>
                      </Box>
                      
                      {prop.rating !== undefined && prop.rating > 0 && (
                        <Badge colorScheme="green" ml={2} display="flex" alignItems="center">
                          ★ {prop.rating}
                        </Badge>
                      )}
                    </Flex>
                  ))}
                </VStack>
              </Box>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} isDisabled={isLoading}>
            Cancelar
          </Button>
          
          {fetchedProperties.length > 0 && (
            <Button 
              colorScheme="blue" 
              onClick={handleSaveProperties}
              isLoading={isLoading}
              loadingText="Salvando..."
              isDisabled={!Object.values(selectedProperties).some(Boolean)}
            >
              Adicionar Selecionados
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
