"use client";

import {
  Box,
  Grid,
  Heading,
  Skeleton,
  SkeletonText,
  VStack,
} from "@chakra-ui/react";
import dynamic from "next/dynamic";
import React from "react";
import "../../../i18n";
import EventosProximos from "./components/EventosProximos";
import Filtro from "./components/Filter";

const AirbnbMap = dynamic(() => import("./components/GoogleMapEmbed"), { ssr: false });

export default function Home() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000); // 3 segundos
    return () => clearTimeout(timer);
  }, []);

if (loading) {
  return (
    <Box width="100%" py={16} px={4}>
      {/* Skeleton para o título */}
      <Skeleton
        height="40px"
        width="300px"
        mb={10}
        borderRadius="md"
        startColor="gray.100"
        endColor="gray.200"
      />

      {/* Skeleton para grid */}
      <Grid
        templateColumns={{ base: "1fr", md: "1fr 1.8fr 1fr" }}
        gap={6}
        width="100%"
      >
        {/* Skeleton do filtro */}
        <Skeleton
          borderRadius="md"
          height="500px"
          startColor="gray.100"
          endColor="gray.200"
        />

        {/* Skeleton do mapa */}
        <Skeleton
          borderRadius="md"
          height="500px"
          startColor="gray.100"
          endColor="gray.200"
        />

        {/* Skeleton dos eventos próximos */}
        <VStack spacing={4} align="stretch">
          {[...Array(3)].map((_, i) => (
            <Box
              key={i}
              p={4}
         
              borderRadius="md"
              bg="white"
              boxShadow="md"
            >
              <SkeletonText
                noOfLines={2}
                spacing="4"
                startColor="gray.100"
                endColor="gray.200"
              />
            </Box>
          ))}
        </VStack>
      </Grid>
    </Box>
  );
}


  return (
    <Box width="100%" py={16} px={4}>
      <Heading
        as="h1"
        size="2xl"
        mb={10}
        fontWeight="extrabold"
        textAlign={{ base: "left", md: "left" }}
      >
        Mapa Interativo
      </Heading>

      <Grid
        templateColumns={{ base: "1fr", md: "1fr 1.8fr 1fr" }}
        gap={6}
        width="100%"
      >
        <Filtro height={"500px"} />
        <AirbnbMap height="500px" />
        <EventosProximos height="500px" />
      </Grid>
    </Box>
  );
}
