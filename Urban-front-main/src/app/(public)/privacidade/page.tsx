"use client";

import React from "react";
import { Box, Container, Heading, Text, VStack, Divider, UnorderedList, ListItem, Link as ChakraLink } from "@chakra-ui/react";

/**
 * Política de Privacidade — alinhada à LGPD (Lei 13.709/2018).
 *
 * Esta é uma versão DRAFT a ser revisada por advogado especializado em
 * proteção de dados antes de ser publicada como definitiva. Ver
 * `docs/go-live-manual-checklist.md` P2 #14.
 *
 * Estrutura:
 *  1. Quem somos / controlador
 *  2. Quais dados coletamos
 *  3. Bases legais (LGPD art. 7º)
 *  4. Para que usamos
 *  5. Compartilhamento e operadores
 *  6. Retenção
 *  7. Transferência internacional
 *  8. Seus direitos (LGPD art. 18)
 *  9. Cookies
 * 10. Segurança
 * 11. Encarregado / DPO
 * 12. Mudanças nesta política
 */
export default function Privacidade() {
  return (
    <Container maxW="container.lg" py={8}>
      <Box bg="white" p={{ base: 6, md: 10 }} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
        <Heading as="h1" size="xl" mb={4} color="#1C1D3B">
          Política de Privacidade
        </Heading>
        <Text color="gray.500" mb={2} fontSize="sm">
          Última atualização: 05 de maio de 2026
        </Text>
        <Text color="gray.500" mb={8} fontSize="xs" fontStyle="italic">
          Versão alinhada à Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD). Documento DRAFT — revisão jurídica externa em andamento.
        </Text>

        <VStack spacing={6} align="flex-start" color="gray.700" lineHeight="tall" fontSize="md">
          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              1. Quem somos
            </Heading>
            <Text>
              A <strong>Urban AI</strong> ("nós") é uma plataforma de precificação dinâmica
              para anfitriões de aluguel por temporada. Esta política descreve como tratamos
              dados pessoais coletados quando você usa nossos serviços em <code>myurbanai.com</code>.
            </Text>
            <Text mt={2}>
              <strong>Controladora dos dados:</strong> MP IA Tecnologia Ltda, inscrita no CNPJ sob nº{" "}
              <strong>62.497.936/0001-27</strong>, com sede na Rua Doutor Cesar, 530, Conj 804,
              Santana, São Paulo/SP, CEP 02013-002.
            </Text>
            <Text mt={2}>
              <strong>Operadora do produto:</strong> Gustavo Gouveia Macedo LTDA (nome fantasia "Guilds"),
              CNPJ 44.361.255/0001-55, presta serviço contínuo de operação técnica e gestão do produto Urban AI
              à MP IA Tecnologia desde fevereiro de 2026.
            </Text>
            <Text mt={2}>
              Para questões de privacidade, contate{" "}
              <ChakraLink href="mailto:privacidade@myurbanai.com" color="blue.600">
                privacidade@myurbanai.com
              </ChakraLink>.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              2. Quais dados coletamos
            </Heading>
            <Text mb={2}>
              <strong>2.1. Dados de cadastro:</strong> nome, e-mail, telefone (opcional),
              senha (armazenada como hash bcrypt — nunca em texto claro).
            </Text>
            <Text mb={2}>
              <strong>2.2. Dados das propriedades:</strong> endereço, número de quartos/banheiros,
              foto pública do anúncio, ID público do anúncio Airbnb (quando informado).
            </Text>
            <Text mb={2}>
              <strong>2.3. Dados de uso:</strong> análises de preço solicitadas, recomendações
              aceitas, datas de acesso, IP de origem (apenas para auditoria de segurança).
            </Text>
            <Text mb={2}>
              <strong>2.4. Dados de pagamento:</strong> NÃO armazenamos cartões. O processamento
              é feito pelo Stripe, que mantém os dados conforme PCI-DSS. Recebemos apenas
              metadados da assinatura (status, ciclo, plano).
            </Text>
            <Text mb={2}>
              <strong>2.5. Dados da Stays (quando conectada):</strong> tokens OAuth para
              acesso via Open API, IDs de listings, preços base. Tokens são armazenados
              criptografados em repouso.
            </Text>
            <Text>
              <strong>2.6. Cookies e telemetria:</strong> ver seção 9 abaixo.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              3. Bases legais para o tratamento (LGPD art. 7º)
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>
                <strong>Execução de contrato</strong> (art. 7º, V): tratamento essencial para
                fornecer o serviço — autenticação, geração de análises, cobrança.
              </ListItem>
              <ListItem>
                <strong>Legítimo interesse</strong> (art. 7º, IX): segurança da plataforma,
                detecção de fraude, melhoria do produto via dados agregados anonimizados.
              </ListItem>
              <ListItem>
                <strong>Consentimento</strong> (art. 7º, I): cookies de analytics e marketing
                (GA4, Meta Pixel) — só carregados após você aceitar no banner de consent.
              </ListItem>
              <ListItem>
                <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): retenção fiscal
                de notas e dados de pagamento por 5 anos (CTN art. 174).
              </ListItem>
            </UnorderedList>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              4. Para que usamos seus dados
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>Gerar recomendações de preço para os imóveis cadastrados.</ListItem>
              <ListItem>
                Compor um <strong>dataset proprietário agregado</strong> de mercado para
                treinar modelos de Machine Learning. Snapshots de preço de imóveis
                cadastrados são usados de forma <em>anonimizada</em> (sem identificação do
                proprietário) para alimentar o motor.
              </ListItem>
              <ListItem>Enviar comunicados transacionais (recibos, alertas de quota, recuperação de senha).</ListItem>
              <ListItem>Responder a solicitações de suporte e cumprir obrigações legais.</ListItem>
              <ListItem>
                Marketing direto <strong>somente</strong> com seu consentimento explícito
                (e você pode retirar a qualquer momento).
              </ListItem>
            </UnorderedList>
            <Text mt={3} fontSize="sm" color="gray.600">
              Seus dados <strong>não são vendidos</strong> a terceiros, brokers de dados ou
              redes de publicidade.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              5. Operadores e compartilhamento
            </Heading>
            <Text mb={2}>
              Compartilhamos dados estritamente necessários com operadores que nos
              prestam serviços, sob acordos de proteção de dados:
            </Text>
            <UnorderedList spacing={2}>
              <ListItem><strong>Guilds (Gustavo Gouveia Macedo LTDA)</strong> — operação técnica e gestão do produto desde fev/2026</ListItem>
              <ListItem><strong>Railway</strong> — hospedagem de servidor e banco de dados</ListItem>
              <ListItem><strong>Stripe</strong> — processamento de pagamento e cobrança recorrente</ListItem>
              <ListItem><strong>SendGrid (Twilio)</strong> — envio de e-mails transacionais (fluxos legados: recuperação de senha, alertas de imóveis)</ListItem>
              <ListItem><strong>MailerSend</strong> — envio de e-mails transacionais (fluxos novos: waitlist, parte do cron)</ListItem>
              <ListItem><strong>RapidAPI</strong> — enriquecimento de dados públicos do Airbnb (disponibilidade, preço de mercado)</ListItem>
              <ListItem><strong>Google Cloud (Maps + Gemini)</strong> — geocoding e análise de eventos</ListItem>
              <ListItem><strong>Sentry</strong> — monitoramento de erros (somente metadados técnicos, nunca payload de usuário)</ListItem>
              <ListItem><strong>Stays.net</strong> — quando você conecta sua conta para envio automático de preços</ListItem>
            </UnorderedList>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              6. Retenção
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>
                <strong>Conta ativa:</strong> retemos enquanto sua conta estiver ativa.
              </ListItem>
              <ListItem>
                <strong>Após exclusão:</strong> dados pessoais identificáveis são removidos em até
                30 dias. Dados anonimizados (snapshots agregados) podem ser mantidos
                indefinidamente para fins estatísticos.
              </ListItem>
              <ListItem>
                <strong>Dados fiscais:</strong> retemos por 5 anos após o último pagamento
                conforme art. 174 do CTN.
              </ListItem>
              <ListItem>
                <strong>Logs de segurança:</strong> 90 dias.
              </ListItem>
            </UnorderedList>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              7. Transferência internacional
            </Heading>
            <Text>
              Alguns operadores (Stripe, Sentry, Google) processam dados em servidores fora
              do Brasil. Quando isso ocorre, garantimos que existem cláusulas contratuais
              padrão e adequação reconhecida pela ANPD ou jurisdição equivalente, conforme
              LGPD art. 33.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              8. Seus direitos (LGPD art. 18)
            </Heading>
            <Text mb={2}>Você tem direito a:</Text>
            <UnorderedList spacing={2}>
              <ListItem><strong>Acesso:</strong> saber quais dados temos sobre você.</ListItem>
              <ListItem><strong>Correção:</strong> pedir correção de dados incompletos ou desatualizados.</ListItem>
              <ListItem><strong>Anonimização ou eliminação:</strong> de dados desnecessários ou tratados em desconformidade.</ListItem>
              <ListItem><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</ListItem>
              <ListItem><strong>Eliminação</strong> de dados tratados com base em consentimento.</ListItem>
              <ListItem><strong>Revogação de consentimento</strong> a qualquer momento.</ListItem>
              <ListItem><strong>Oposição</strong> ao tratamento baseado em legítimo interesse.</ListItem>
              <ListItem><strong>Reclamação à ANPD</strong> caso entenda que seus direitos não foram respeitados.</ListItem>
            </UnorderedList>
            <Text mt={3}>
              Para exercer qualquer destes direitos, escreva para{" "}
              <ChakraLink href="mailto:privacidade@myurbanai.com" color="blue.600">
                privacidade@myurbanai.com
              </ChakraLink>{" "}
              — respondemos em até 15 dias.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              9. Cookies e tecnologias similares
            </Heading>
            <Text mb={2}>
              Usamos três categorias de cookies:
            </Text>
            <UnorderedList spacing={2}>
              <ListItem>
                <strong>Essenciais</strong> (sempre ativos): autenticação, segurança CSRF,
                sessão. Sem estes a plataforma não funciona.
              </ListItem>
              <ListItem>
                <strong>Analytics</strong> (opcional, com consentimento): Google Analytics 4
                para entender como usuários navegam e melhorar o produto.
              </ListItem>
              <ListItem>
                <strong>Marketing</strong> (opcional, com consentimento): Meta Pixel para
                medir eficácia de campanhas de aquisição.
              </ListItem>
            </UnorderedList>
            <Text mt={3} fontSize="sm" color="gray.600">
              Você pode revisar suas preferências a qualquer momento via banner no rodapé
              ou em <strong>Configurações da conta → Privacidade</strong>.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              10. Segurança
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>Senhas armazenadas como hash bcrypt (nunca em texto claro).</ListItem>
              <ListItem>Tráfego HTTPS/TLS 1.3 em toda a plataforma.</ListItem>
              <ListItem>Banco de dados criptografado em repouso (AES-256 do provider).</ListItem>
              <ListItem>Acesso administrativo restrito por role + autenticação JWT com expiração curta.</ListItem>
              <ListItem>Backup off-site diário com retenção controlada.</ListItem>
              <ListItem>Monitoramento contínuo de erros e tentativas de acesso anômalo (Sentry, rate limit).</ListItem>
            </UnorderedList>
            <Text mt={3} fontSize="sm" color="gray.600">
              Em caso de incidente envolvendo dados pessoais, comunicaremos a ANPD e os
              titulares afetados conforme LGPD art. 48.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              11. Encarregado de Proteção de Dados (DPO)
            </Heading>
            <Text>
              <strong>Encarregado (DPO):</strong> a designar (designação formal em curso).{" "}
              Enquanto isso, o canal oficial é{" "}
              <ChakraLink href="mailto:privacidade@myurbanai.com" color="blue.600">
                privacidade@myurbanai.com
              </ChakraLink>.
            </Text>
            <Text mt={2} fontSize="sm" color="gray.600">
              O canal acima é o ponto de contato oficial para exercer seus direitos da LGPD e
              para questões da Autoridade Nacional de Proteção de Dados (ANPD). O nome do
              Encarregado será publicado nesta página assim que a designação for formalizada.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              12. Mudanças nesta política
            </Heading>
            <Text>
              Podemos atualizar esta política. Mudanças relevantes serão comunicadas por
              e-mail e/ou banner na plataforma com pelo menos 7 dias de antecedência. A
              data no topo desta página indica a versão vigente.
            </Text>
          </Box>

          <Divider borderColor="gray.200" />
          <Text fontSize="xs" color="gray.500" fontStyle="italic">
            Esta política é uma versão de trabalho e está em revisão por consultor jurídico
            externo especializado em LGPD. Mudanças que decorram dessa revisão serão
            comunicadas via e-mail antes de produzirem efeito.
          </Text>
        </VStack>
      </Box>
    </Container>
  );
}
