"use client";

import React from "react";
import { Box, Container, Heading, Text, VStack, Divider } from "@chakra-ui/react";
import { TERMS_UPDATED_AT, termsBlocks } from "../legalContent";

export default function Termos() {
  return (
    <main className="urban-manifesto urban-public-page">
      <section className="urban-public-section">
        <Container maxW="container.lg" py={0}>
          <Box className="urban-legal-panel" bg="white" p={{ base: 0, md: 0 }} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
            <Heading as="h1" size="xl" mb={4} color="#1C1D3B">
              Termos de Uso
            </Heading>
            <Text color="gray.500" mb={8} fontSize="sm">
              Última atualização: {TERMS_UPDATED_AT}
            </Text>
            <LegalDocument blocks={termsBlocks} />
          </Box>
        </Container>
      </section>
    </main>
  );
}

function LegalDocument({
  blocks,
}: {
  blocks: Array<{ kind: "title" | "section" | "paragraph"; text: string }>;
}) {
  return (
    <VStack spacing={4} align="flex-start" color="gray.700" lineHeight="tall" fontSize="md">
      {blocks.map((block, index) => {
        if (block.kind === "title") {
          return (
            <Text key={index} fontWeight={700} color="#1C1D3B">
              {block.text}
            </Text>
          );
        }

        if (block.kind === "section") {
          return (
            <Box key={index} w="full" pt={index === 1 ? 0 : 4}>
              {index > 1 && <Divider borderColor="gray.200" mb={4} />}
              <Heading as="h2" size="md" color="blue.600">
                {block.text}
              </Heading>
            </Box>
          );
        }

        return (
          <Text key={index} whiteSpace="pre-wrap">
            {block.text}
          </Text>
        );
      })}
    </VStack>
  );
}
