import {
  Box,
  Heading,
  VStack,
  FormControl,
  FormLabel,
  Select,
  HStack,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";

type FiltroProps = {
  height?: string | number;
};

export default function Filtro({ height }: FiltroProps) {
  const bg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const headingColor = useColorModeValue("gray.800", "whiteAlpha.900");

  return (
    <Box
      p={6}
      borderWidth={1}
      borderRadius="lg"
      bg={bg}
      boxShadow="sm"
      borderColor={borderColor}
      height={height}
      overflowY="auto"
      maxW="400px"
   
    >
      <Heading size="lg" mb={6} color={headingColor} letterSpacing="wide">
        Filtros
      </Heading>

      <VStack spacing={6} align="stretch">
        {/* Raio de busca */}
        <FormControl>
          <FormLabel fontWeight="semibold" color={headingColor}>
            Raio de busca
          </FormLabel>
          <Select placeholder="Selecione o raio" focusBorderColor="teal.400" size="md">
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="50">50 km</option>
          </Select>
        </FormControl>

        {/* Tipo de evento */}
        <FormControl>
          <FormLabel fontWeight="semibold" color={headingColor}>
            Tipo de evento
          </FormLabel>
          <Select placeholder="Selecione o tipo" focusBorderColor="teal.400" size="md">
            <option value="incendio">Incêndio</option>
            <option value="enchente">Enchente</option>
            <option value="deslizamento">Deslizamento</option>
            <option value="outro">Outro</option>
          </Select>
        </FormControl>

        {/* Impacto esperado */}
        <Box>
          <FormLabel fontWeight="semibold" color={headingColor} mb={3}>
            Impacto esperado
          </FormLabel>
          <HStack spacing={4}>
            <Badge
              colorScheme="red"
              px={4}
              py={2}
              borderRadius="full"
              cursor="pointer"
              _hover={{ opacity: 0.8 }}
              fontWeight="bold"
              fontSize="sm"
            >
              Alto
            </Badge>
            <Badge
              colorScheme="yellow"
              px={4}
              py={2}
              borderRadius="full"
              cursor="pointer"
              _hover={{ opacity: 0.8 }}
              fontWeight="bold"
              fontSize="sm"
            >
              Médio
            </Badge>
            <Badge
              colorScheme="green"
              px={4}
              py={2}
              borderRadius="full"
              cursor="pointer"
              _hover={{ opacity: 0.8 }}
              fontWeight="bold"
              fontSize="sm"
            >
              Baixo
            </Badge>
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
}
