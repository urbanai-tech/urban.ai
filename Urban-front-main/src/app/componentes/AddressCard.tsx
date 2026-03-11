'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
  Image,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getAddressByCep } from "../service/api";
import { ToastContainer, toast } from 'react-toastify';


interface AddressCardProps {
  title: string;
  imageUrl: string;
  cep: string;
  number: string;
  onCepChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  isValid: boolean;
  validationMessage: string | null;
  onAddressUpdate?: (addressData: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => void;
}

export default function AddressCard({
  title,
  imageUrl,
  cep,
  number,
  onCepChange,
  onNumberChange,
  isValid,
  validationMessage,
  onAddressUpdate,
}: AddressCardProps) {
  const { t } = useTranslation();


  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [addressData, setAddressData] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const formatCep = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= 5) {
      return numericValue;
    }
    return `${numericValue.slice(0, 5)}-${numericValue.slice(5, 8)}`;
  };

  const isValidCep = (cep: string): boolean => {
    const cleanCep = cep.replace(/\D/g, "");
    return cleanCep.length === 8;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    onCepChange(formatted);
    setCepError(null);
    if (!isValidCep(formatted)) {
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, "");
    onNumberChange(numericValue);
  };

  const consultarCep = async () => {
    if (!isValidCep(cep)) {
      setCepError(t("address.cep_invalid_digits"));
      toast("O CEP informado não é válido. Verifique e tente novamente.", { type: "error" });
      return;
    }

    try {
      setIsLoadingCep(true);
      setCepError(null);
      const response = await getAddressByCep(cep);
      const newAddressData = {
        street: response.street || "",
        neighborhood: response.neighborhood || "",
        city: response.city || "",
        state: response.state || "",
      };
      setAddressData(newAddressData);
      onAddressUpdate?.(newAddressData)
      toast("Dados do CEP encontrado", { type: "success" });
    } catch (error) {
      console.error("Erro ao consultar CEP:", error);
      setCepError(t("address.cep_not_found_description"));
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
      toast("O CEP informado não é válido. Verifique e tente novamente.", { type: "error" });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const isAddressComplete =
    !!addressData.street &&
    !!addressData.neighborhood &&
    !!addressData.city &&
    !!addressData.state &&
    isValidCep(cep) &&
    !!number;

  return (
    <Box
      bg="white"
      borderRadius="2xl"
      p={0}
      border="1px solid"
      borderColor={
        isAddressComplete
          ? "green.200"
          : isLoadingCep
            ? "blue.200"
            : cepError
              ? "red.200"
              : "gray.200"
      }
      shadow={isAddressComplete ? "lg" : "sm"}
      _hover={{ shadow: "lg", transform: "translateY(-2px)" }}
      transition="all 0.3s"
      position="relative"
      overflow="hidden"
    >
      {/* Imagem do imóvel */}
      <Box w="100%" h={{ base: "180px", md: "200px" }} overflow="hidden" borderTopRadius="2xl">
        <Image
          src={imageUrl}
          alt={title}
          w="100%"
          h="100%"
          objectFit="cover"
          borderTopRadius="2xl"
          fallbackSrc="https://via.placeholder.com/400x200?text=Foto+Indisponível"
        />
      </Box>
      <Box p={8}>
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="4px"
          bg={
            isAddressComplete
              ? "green.400"
              : isLoadingCep
                ? "blue.400"
                : cepError
                  ? "red.400"
                  : "gray.200"
          }
          transition="all 0.3s"
        />
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Text fontSize="2xl" fontWeight="700" color="gray.900">
                {title}
              </Text>
              {isLoadingCep && (
                <HStack spacing={2}>
                  <Spinner size="xs" color="blue.500" />
                  <Text fontSize="sm" color="blue.600" fontWeight="medium">
                    {t("address.consulting_cep")}
                  </Text>
                </HStack>
              )}
            </VStack>
            {isAddressComplete && (
              <Badge colorScheme="green" variant="subtle" px={3} py={1} borderRadius="full" fontSize="xs">
                ✓ {t("address.address_complete")}
              </Badge>
            )}
          </HStack>

          {(addressData.neighborhood || addressData.city || addressData.state) && (
            <Box bg="gray.50" borderRadius="xl" p={4} border="1px solid" borderColor="gray.100">
              <Text fontSize="xs" color="gray.500" fontWeight="medium" mb={1} textTransform="uppercase">
                {t("address.found_address")}
              </Text>
              <Text fontSize="lg" color="gray.900" fontWeight="semibold" mb={1}>
                {addressData.street}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {[addressData.neighborhood, addressData.city, addressData.state].filter(Boolean).join(" • ")}
              </Text>
            </Box>
          )}

          <HStack spacing={4} align="end">
            <FormControl flex="1">
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={3}>
                {t("address.cep_label")}
              </FormLabel>
              <Input
                placeholder="00000-000"
                value={cep}
                onChange={handleCepChange}
                maxLength={9}
                size="lg"
                fontSize="lg"
                fontWeight="500"
                isDisabled={isLoadingCep}
              />
            </FormControl>

            <FormControl flex="1">
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={3}>
                {t("address.number_label")}
              </FormLabel>
              <Input
                placeholder="123"
                value={number}
                onChange={handleNumberChange}
                size="lg"
                fontSize="lg"
                fontWeight="500"
              />
            </FormControl>

            <Button
              onClick={consultarCep}
              isDisabled={!isValidCep(cep) || isLoadingCep}
              isLoading={isLoadingCep}
              size="lg"
              height="56px"
              minW="140px"
              bg={isValidCep(cep) ? "blue.500" : "gray.300"}
              color="white"
              fontWeight="600"
              _hover={{ bg: isValidCep(cep) ? "blue.600" : "gray.300" }}
              loadingText={t("address.searching_cep")}
            >
              {isLoadingCep ? t("address.searching_cep") : t("address.search_cep")}
            </Button>
          </HStack>

          <VStack spacing={3} align="stretch">
            {cepError && (
              <Alert status="error" borderRadius="xl" bg="red.50" border="1px solid" borderColor="red.200">
                <AlertIcon color="red.500" />
                <AlertDescription fontSize="sm" color="red.700" fontWeight="medium">
                  {cepError}
                </AlertDescription>
              </Alert>
            )}

            {validationMessage === "cep" && (
              <Alert status="error" borderRadius="xl" bg="red.50" border="1px solid" borderColor="red.200">
                <AlertIcon color="red.500" />
                <AlertDescription fontSize="sm" color="red.700" fontWeight="medium">
                  {t("address.cep_invalid_digits")}
                </AlertDescription>
              </Alert>
            )}

            {validationMessage === "number" && (
              <Alert status="error" borderRadius="xl" bg="red.50" border="1px solid" borderColor="red.200">
                <AlertIcon color="red.500" />
                <AlertDescription fontSize="sm" color="red.700" fontWeight="medium">
                  {t("address.number_required")}
                </AlertDescription>
              </Alert>
            )}

            {isAddressComplete && (
              <Alert status="success" borderRadius="xl" bg="green.50" border="1px solid" borderColor="green.200">
                <AlertIcon color="green.500" />
                <AlertDescription fontSize="sm" color="green.700" fontWeight="semibold">
                  {t("address.address_complete")}
                </AlertDescription>
              </Alert>
            )}

            {isValid && !isAddressComplete && (
              <Alert status="info" borderRadius="xl" bg="blue.50" border="1px solid" borderColor="blue.200">
                <AlertIcon color="blue.500" />
                <AlertDescription fontSize="sm" color="blue.700" fontWeight="medium">
                  {t("address.address_valid")}
                </AlertDescription>
              </Alert>
            )}
          </VStack>
        </VStack>
      </Box>
      <ToastContainer />
    </Box>
  );
}
