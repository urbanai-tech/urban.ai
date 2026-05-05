"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Text,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Stack,
  Link as ChakraLink,
  useDisclosure,
} from "@chakra-ui/react";
import { useConsent } from "./useConsent";

/**
 * Banner de consentimento LGPD para cookies / telemetria.
 *
 * Aparece apenas quando `useConsent.undecided === true` (usuário ainda não
 * tomou decisão). Após decidir (aceitar tudo / rejeitar tudo / personalizar),
 * o banner some até o user limpar localStorage ou clicar em "Preferências"
 * (link no footer/menu).
 *
 * Comportamento:
 *  - "Aceitar todos" → analytics + marketing = true
 *  - "Apenas essenciais" → analytics + marketing = false
 *  - "Personalizar" → modal com toggles individuais
 *
 * Não bloqueia uso da plataforma (não é "cookie wall"). Cookies essenciais
 * sempre estão ativos.
 */
export function CookieConsent() {
  const { undecided, acceptAll, rejectAll, setPreferences, state } = useConsent();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [analyticsPref, setAnalyticsPref] = useState(state.analytics);
  const [marketingPref, setMarketingPref] = useState(state.marketing);

  if (!undecided) return null;

  return (
    <>
      <Box
        position="fixed"
        bottom={{ base: 0, md: 4 }}
        left={{ base: 0, md: 4 }}
        right={{ base: 0, md: 4 }}
        zIndex={9999}
        bg="white"
        borderRadius={{ base: 0, md: "xl" }}
        boxShadow="0 8px 32px rgba(0,0,0,0.16)"
        borderWidth="1px"
        borderColor="gray.200"
        p={{ base: 4, md: 5 }}
        maxW={{ md: "4xl" }}
        mx="auto"
        role="region"
        aria-label="Consentimento de cookies"
      >
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          gap={4}
        >
          <Box flex="1" fontSize="sm" color="gray.700">
            <Text fontWeight="bold" mb={1} color="gray.800">
              Privacidade e cookies
            </Text>
            <Text>
              Usamos cookies essenciais para o funcionamento da plataforma e,
              com seu consentimento, cookies opcionais de analytics e
              marketing para entender o uso e melhorar o produto. Veja
              detalhes na{" "}
              <ChakraLink href="/privacidade" color="blue.600" isExternal={false}>
                Política de Privacidade
              </ChakraLink>.
            </Text>
          </Box>

          <Stack
            direction={{ base: "column", sm: "row" }}
            spacing={2}
            flexShrink={0}
            w={{ base: "full", md: "auto" }}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAnalyticsPref(state.analytics);
                setMarketingPref(state.marketing);
                onOpen();
              }}
            >
              Personalizar
            </Button>
            <Button size="sm" variant="outline" onClick={rejectAll}>
              Apenas essenciais
            </Button>
            <Button size="sm" colorScheme="blue" onClick={acceptAll}>
              Aceitar todos
            </Button>
          </Stack>
        </Flex>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Preferências de cookies</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={5}>
              <Box>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel mb={0} fontWeight="bold">
                    Essenciais
                  </FormLabel>
                  <Switch isChecked isDisabled colorScheme="blue" />
                </FormControl>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Necessários para login, segurança e funcionamento básico.
                  Não podem ser desativados.
                </Text>
              </Box>

              <Box>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel htmlFor="analytics-pref" mb={0} fontWeight="bold">
                    Analytics
                  </FormLabel>
                  <Switch
                    id="analytics-pref"
                    isChecked={analyticsPref}
                    onChange={(e) => setAnalyticsPref(e.target.checked)}
                    colorScheme="blue"
                  />
                </FormControl>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Google Analytics 4 — entender quais funcionalidades são
                  usadas para priorizar melhorias. IP anonimizado.
                </Text>
              </Box>

              <Box>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel htmlFor="marketing-pref" mb={0} fontWeight="bold">
                    Marketing
                  </FormLabel>
                  <Switch
                    id="marketing-pref"
                    isChecked={marketingPref}
                    onChange={(e) => setMarketingPref(e.target.checked)}
                    colorScheme="blue"
                  />
                </FormControl>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Meta Pixel — medir eficácia de campanhas e oferecer conteúdo
                  relevante em redes sociais.
                </Text>
              </Box>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={2}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                colorScheme="blue"
                size="sm"
                onClick={() => {
                  setPreferences({
                    analytics: analyticsPref,
                    marketing: marketingPref,
                  });
                  onClose();
                }}
              >
                Salvar preferências
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
