'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Image,
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
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';
import '../../../i18n';
import { getPropriedadesDropdownList, PropertyDropdown, requestDeleteAddress } from '../service/api';
import { toast, ToastContainer } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { AddPropertyModal } from '../componentes/AddPropertyModal';

export default function MyProperties() {
  const { t } = useTranslation();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);

  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await getPropriedadesDropdownList();
      setProperties(data);
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

      <Stack spacing={4} mb={4}>
        {properties.map((prop) => (
          <Flex
            key={prop.id}
            align="center"
            justify="space-between"
            p={3}
            borderRadius="md"
            _hover={{ bg: 'gray.50' }}
          >
            <Flex align="center">
              <Image
                src={prop.image_url}
                alt={prop.propertyName}
                boxSize="60px"
                objectFit="cover"
                borderRadius="md"
                mr={4}
              />
              <Box>
                <Text fontWeight="medium">{prop.propertyName}</Text>
                <Text fontSize="sm" color="gray.500">
                  Latitude: {prop.latitude}, Longitude: {prop.longitude}
                </Text>
              </Box>
            </Flex>
            <IconButton
              aria-label={t('my_properties.delete')}
              icon={<DeleteIcon />}
              variant="ghost"
              colorScheme="red"
              size="sm"
              onClick={() => handleDeleteRequest(prop.id)}
            />
          </Flex>
        ))}
      </Stack>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Excluir Propriedade
            </AlertDialogHeader>

            <AlertDialogBody>
              Tem certeza que deseja excluir esta propriedade? O motor de IA não atualizará mais os preços desta unidade. Esta ação não pode ser desfeita.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
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
