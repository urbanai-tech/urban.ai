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
        bottom={{ base: 0, md: 6 }}
        left={{ base: 0, md: "auto" }}
        right={{ base: 0, md: 6 }}
        zIndex={9999}
        bg="#080A0F"
        color="white"
        borderRadius={{ base: 0, md: "lg" }}
        boxShadow="0 18px 50px rgba(0,0,0,0.38)"
        borderWidth="1px"
        borderColor="rgba(255,255,255,0.16)"
        p={{ base: 3, md: 4 }}
        maxW={{ md: "390px" }}
        mx={{ base: 0, md: "initial" }}
        role="region"
        aria-label="Consentimento de cookies"
      >
        <Flex
          direction="column"
          align="stretch"
          gap={3}
        >
          <Box flex="1" fontSize="xs" color="rgba(255,255,255,0.70)">
            <Text fontWeight="bold" mb={1} color="white">
              Privacidade e cookies
            </Text>
            <Text>
              Usamos cookies essenciais para o funcionamento da plataforma e,
              com seu consentimento, cookies opcionais de analytics e
              marketing para entender o uso e melhorar o produto. Veja
              detalhes na{" "}
              <ChakraLink
                href="/privacidade"
                color="#FF8A4C"
                textDecoration="underline"
                textUnderlineOffset="2px"
                isExternal={false}
              >
                Política de Privacidade
              </ChakraLink>.
            </Text>
          </Box>

          <Stack
            direction={{ base: "column", sm: "row" }}
            spacing={2}
            flexShrink={0}
            w="full"
          >
            <Button
              size="sm"
              variant="ghost"
              color="rgba(255,255,255,0.82)"
              _hover={{ bg: "rgba(255,255,255,0.08)" }}
              onClick={() => {
                setAnalyticsPref(state.analytics);
                setMarketingPref(state.marketing);
                onOpen();
              }}
            >
              Personalizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(255,255,255,0.24)"
              color="white"
              _hover={{ bg: "rgba(255,255,255,0.08)" }}
              onClick={rejectAll}
            >
              Apenas essenciais
            </Button>
            <Button
              size="sm"
              bg="#E8500A"
              color="#080A0F"
              _hover={{ bg: "#ff641f" }}
              onClick={acceptAll}
            >
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
