"use client";

import React from "react";
import { Box, Container, Heading, Text, VStack, Divider, UnorderedList, ListItem, Link as ChakraLink } from "@chakra-ui/react";

/**
 * Termos de Uso — versão draft a ser revisada por consultor jurídico
 * antes de virar definitiva. Ver `docs/go-live-manual-checklist.md` P2 #14.
 */
export default function Termos() {
  return (
    <Container maxW="container.lg" py={8}>
      <Box bg="white" p={{ base: 6, md: 10 }} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
        <Heading as="h1" size="xl" mb={4} color="#1C1D3B">
          Termos de Uso
        </Heading>
        <Text color="gray.500" mb={2} fontSize="sm">
          Última atualização: 25 de abril de 2026
        </Text>
        <Text color="gray.500" mb={8} fontSize="xs" fontStyle="italic">
          Ao usar a Urban AI você concorda com estes termos. Se discorda, por
          favor não utilize a plataforma.
        </Text>

        <VStack spacing={6} align="flex-start" color="gray.700" lineHeight="tall" fontSize="md">
          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              1. Sobre o serviço
            </Heading>
            <Text>
              A Urban AI ("nós", "nosso") fornece uma plataforma SaaS de
              precificação dinâmica para anfitriões de aluguel por temporada
              (Airbnb, Booking, Vrbo e similares). Nossa missão é ajudar você a
              tomar melhores decisões de preço cruzando dados de mercado, eventos
              próximos e padrões históricos.
            </Text>
            <Text mt={2}>
              <strong>Não somos uma corretora, OTA ou intermediadora de
              hospedagem.</strong> Não vendemos diárias, não captamos clientes e
              não somos responsáveis pelas reservas que você fechar.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              2. Cadastro e elegibilidade
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>
                Você precisa ter 18+ anos e capacidade civil plena para criar
                conta.
              </ListItem>
              <ListItem>
                As informações cadastradas devem ser verdadeiras, completas e
                mantidas atualizadas.
              </ListItem>
              <ListItem>
                Você é responsável pela confidencialidade da sua senha e por
                todo uso feito a partir da sua conta.
              </ListItem>
              <ListItem>
                Cada conta é pessoal e intransferível. Compartilhar credenciais
                pode resultar em suspensão.
              </ListItem>
            </UnorderedList>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              3. Planos, cobrança e cobrança por imóvel
            </Heading>
            <Text mb={2}>
              A Urban AI cobra por <strong>imóvel cadastrado</strong>, com
              ciclos de pagamento mensal, trimestral, semestral ou anual. O
              valor por imóvel × número de imóveis × ciclo é apresentado antes
              do checkout.
            </Text>
            <UnorderedList spacing={2}>
              <ListItem>
                O processamento de pagamento é feito pelo Stripe — não
                armazenamos cartão.
              </ListItem>
              <ListItem>
                Cobrança recorrente automática até cancelamento. Cancele a
                qualquer momento via <strong>Minha Conta → Plano</strong>.
              </ListItem>
              <ListItem>
                Cancelamento entra em vigor ao final do ciclo já pago. Não
                fazemos reembolso proporcional para ciclos já iniciados, exceto
                quando exigido por lei.
              </ListItem>
              <ListItem>
                Se você ultrapassar a quota de imóveis do plano, o cadastro de
                novos imóveis é bloqueado até upgrade.
              </ListItem>
              <ListItem>
                Reajustes de preço são comunicados por e-mail com pelo menos
                30 dias de antecedência.
              </ListItem>
            </UnorderedList>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              4. Período de teste e garantia
            </Heading>
            <Text>
              Quando oferecermos período de teste gratuito, ele será claramente
              identificado no momento do cadastro. Garantia de satisfação,
              quando aplicável, está descrita na página de planos vigente no
              momento da contratação.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              5. Natureza das recomendações
            </Heading>
            <Text mb={2}>
              As recomendações de preço da Urban AI são <strong>sugestões
              baseadas em dados</strong> e estimativas estatísticas. Elas não
              constituem garantia de resultado financeiro, ocupação ou
              receita.
            </Text>
            <Text>
              <strong>Você é o decisor final</strong> sobre qual preço cobrar
              em seus anúncios. Nosso modo "automático" via integração Stays
              opera dentro de tetos de variação que você define e pode pausar
              a qualquer momento.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              6. Uso aceitável
            </Heading>
            <Text mb={2}>Ao usar a Urban AI você se compromete a NÃO:</Text>
            <UnorderedList spacing={2}>
              <ListItem>
                Cadastrar imóveis que não pertençam a você ou para os quais não
                tenha autorização do proprietário.
              </ListItem>
              <ListItem>
                Tentar burlar limites de quota, throttling ou medidas de
                segurança.
              </ListItem>
              <ListItem>
                Fazer scraping, reverse engineering, ou redistribuir conteúdo
                proprietário (recomendações, dataset, código).
              </ListItem>
              <ListItem>
                Usar a plataforma para fins ilegais ou que violem direitos de
                terceiros.
              </ListItem>
              <ListItem>
                Compartilhar acesso de admin ou explorar credenciais de outros
                usuários.
              </ListItem>
            </UnorderedList>
            <Text mt={3} fontSize="sm" color="gray.600">
              Violações podem resultar em suspensão ou encerramento de conta
              sem reembolso, sem prejuízo de medidas legais cabíveis.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              7. Propriedade intelectual
            </Heading>
            <Text>
              O código, design, marca, modelos de Machine Learning e dataset
              proprietário da Urban AI são protegidos por direitos autorais e
              demais leis aplicáveis. Você recebe licença <strong>limitada,
              não-exclusiva e não-transferível</strong> para usar a plataforma
              enquanto sua conta estiver ativa. Esta licença não outorga
              titularidade sobre o software.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              8. Integrações com terceiros (Stays, Stripe, Google etc.)
            </Heading>
            <Text>
              Quando você conecta serviços externos (ex: Stays para
              sincronização de preço, Stripe para cobrança), aplicam-se também
              os termos daquele serviço. A Urban AI atua como integradora — não
              somos responsáveis por interrupções, erros ou políticas dos
              serviços de terceiros.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              9. Disponibilidade e SLA
            </Heading>
            <Text>
              Buscamos disponibilidade alta mas não garantimos serviço
              ininterrupto. Janelas de manutenção planejadas serão comunicadas
              previamente. Em caso de indisponibilidade prolongada por nossa
              responsabilidade, créditos pro-rata podem ser concedidos
              conforme nosso SLA público (<code>docs/slo.md</code>).
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              10. Limitação de responsabilidade
            </Heading>
            <Text>
              Nos limites permitidos por lei, a Urban AI não responde por
              lucros cessantes, danos indiretos ou consequenciais decorrentes
              do uso ou impossibilidade de uso da plataforma. Nossa
              responsabilidade total por qualquer reclamação é limitada ao
              valor pago por você nos 12 meses anteriores ao evento.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              11. Encerramento
            </Heading>
            <Text mb={2}>
              <strong>Pelo usuário:</strong> a qualquer momento via Minha
              Conta. Dados pessoais identificáveis são removidos em até 30
              dias após a confirmação.
            </Text>
            <Text>
              <strong>Pela Urban AI:</strong> em caso de violação destes
              termos, fraude, uso abusivo ou inadimplência prolongada,
              podemos suspender ou encerrar a conta com aviso prévio quando
              razoável.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              12. Mudanças nestes termos
            </Heading>
            <Text>
              Podemos atualizar estes termos. Mudanças relevantes serão
              comunicadas por e-mail e banner na plataforma com pelo menos 30
              dias de antecedência. Continuar usando a plataforma após a
              vigência implica aceite das novas condições.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              13. Lei aplicável e foro
            </Heading>
            <Text>
              Estes termos são regidos pelas leis brasileiras. Fica eleito o
              foro da Comarca da sede da Urban AI para dirimir controvérsias,
              salvo disposições contrárias previstas no Código de Defesa do
              Consumidor.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              14. Contato
            </Heading>
            <Text>
              Dúvidas sobre estes termos:{" "}
              <ChakraLink href="mailto:legal@urban.ai" color="blue.600">
                legal@urban.ai
              </ChakraLink>
              . Para exercer direitos da LGPD, ver nossa{" "}
              <ChakraLink href="/privacidade" color="blue.600">
                Política de Privacidade
              </ChakraLink>.
            </Text>
          </Box>

          <Divider borderColor="gray.200" />
          <Text fontSize="xs" color="gray.500" fontStyle="italic">
            Estes termos são uma versão draft em revisão por consultor
            jurídico externo. Mudanças decorrentes dessa revisão serão
            comunicadas via e-mail antes de produzirem efeito.
          </Text>
        </VStack>
      </Box>
    </Container>
  );
}
