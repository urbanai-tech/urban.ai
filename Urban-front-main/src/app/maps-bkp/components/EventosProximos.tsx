import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  Flex,
  useColorModeValue,
} from "@chakra-ui/react";

type Evento = {
  nome: string;
  impacto: "Alto" | "Médio" | "Baixo";
  data: string;
  distancia: string;
  crescimento: string;
};

type EventosProximosProps = {
  height?: string | number;
  eventos?: Evento[];
};

const impactoColorScheme = {
  Alto: "red",
  Médio: "yellow",
  Baixo: "green",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EventosProximos({
  height = "400px",
  eventos = [
    {
      nome: "NEY MATOGROSSO",
      impacto: "Alto",
      data: "2025-09-15",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
    {
      nome: "Jogo Flamengo",
      impacto: "Médio",
      data: "2025-10-20",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
    {
      nome: "Conferência Tech",
      impacto: "Baixo",
      data: "2025-08-25",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
  ],
}: EventosProximosProps) {
  const bg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const textColor = useColorModeValue("gray.700", "gray.300");
  const metaColor = useColorModeValue("gray.500", "gray.400");

  return (
    <Box
      height={height}
      p={6}
      borderWidth={1}
      borderRadius="lg"
      bg={bg}
      boxShadow="sm"
      borderColor={borderColor}
      maxW="600px"
      mx="auto"
      overflowY="auto"
    >
      <Heading size="lg" mb={6} color={textColor} letterSpacing="wide">
        Eventos Próximos
      </Heading>

      <VStack spacing={6} align="stretch">
        {eventos.map((evento, index) => (
          <Box key={index} px={2}>
            <Flex align="center" mb={1}>
              <Text
                fontWeight="bold"
                fontSize="xl"
                color={textColor}
                noOfLines={1}
                flex="1"
              >
                {evento.nome}
              </Text>

              <Badge
                colorScheme={impactoColorScheme[evento.impacto]}
                px={4}
                py={1}
                borderRadius="full"
                fontWeight="semibold"
                fontSize="sm"
                ml={4}
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {evento.impacto}
              </Badge>
            </Flex>

            <HStack
              spacing={8}
              color={metaColor}
              fontSize="sm"
              fontWeight="medium"
              letterSpacing="wider"
            >
              <Text>{formatDate(evento.data)}</Text>
              <Text>{evento.distancia}</Text>
              <Text>{evento.crescimento}</Text>
            </HStack>

            {index !== eventos.length - 1 && (
              <Divider mt={5} borderColor={borderColor} />
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
