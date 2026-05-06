# Urban AI — Política de Privacidade Interna (LGPD)

**Versão:** 1.2 · **Data:** 05/05/2026 · **Controladora:** MP IA Tecnologia Ltda (CNPJ 62.497.936/0001-27) · **Operadora:** Guilds — Gustavo Gouveia Macedo LTDA (CNPJ 44.361.255/0001-55)
**Status:** Documento interno. A versão pública para usuários vive em `/privacidade` no site.

> **Mudanças vs v1.1 (mesma data):** modelo operacional Guilds-MP IA Tecnologia explicitado (Guilds passou a operar o produto em fev/2026 como prestadora de serviço da MP IA Tecnologia); Gustavo reposicionado como COO+CTO operador via Guilds (não sócio, nem informalmente); SendGrid + MailerSend declarados em coexistência (ambos no código); RapidAPI confirmado em 3 hosts (airbnb19, airbnb45, airbnb-search) e adicionado como sub-operador; contato Gustavo padronizado em `gustavo.macedo@guilds.com.br`.

## Identificação do controlador

- **Razão social:** MP IA Tecnologia Ltda
- **Nome fantasia / produto:** Urban AI
- **CNPJ:** 62.497.936/0001-27 · **NIRE:** 35267832213 · **Porte:** ME
- **Sede:** Rua Doutor Cesar, 530, Conj 804, Santana, São Paulo/SP, CEP 02013-002
- **Foro contratual:** Comarca de Barueri/SP
- **Sócios formais:** Carlos Fabricio Mata Padovan (60% — sócio-administrador) e Rogério Mata Padovan (40% — sócio-administrador). Os 2 irmãos Padovan são os únicos sócios e administradores legais da MP IA Tecnologia.

## Operadora declarada

- **Razão social:** Gustavo Gouveia Macedo LTDA (nome fantasia "Guilds")
- **CNPJ:** 44.361.255/0001-55
- **Função:** desde **fevereiro de 2026**, opera o produto Urban AI (gestão técnica, infra, dev, operação) como prestadora de serviço contínuo da MP IA Tecnologia. Em termos LGPD, processa dados pessoais em nome da controladora.
- **Responsável técnico operacional (COO + CTO):** Gustavo Macedo — `gustavo.macedo@guilds.com.br`. Atua via Guilds. **NÃO é sócio da MP IA Tecnologia** — é operador. Existe expectativa de entrada futura como sócio, ainda não formalizada.

A Guilds figura nesta política e no briefing jurídico como sub-operadora ao lado das demais (Stripe, Railway, AWS, etc.).

Este documento responde, em português estruturado, às exigências da LGPD (Lei 13.709/2018). É referência para o time e base para a página pública e para respostas a solicitações de titulares.

---

## 1. Dados pessoais que tratamos

### 1.1 Dados do anfitrião (titular principal)

| Campo | Fonte | Propósito | Retenção |
|---|---|---|---|
| `email` | cadastro | identificador + comunicação transacional | vida da conta + 5 anos |
| `username` | cadastro | exibição no produto | vida da conta |
| `phone` | perfil (opcional) | suporte + notificação | vida da conta |
| `company` | perfil (opcional) | personalização/billing B2B | vida da conta |
| `password` (hash bcrypt) | cadastro/reset | autenticação | vida da conta |
| `airbnbHostId` | onboarding passo 3 | enriquecimento de listings | vida da conta |
| `distanceKm`, `pricingStrategy`, `operationMode`, `percentualInicial/Final` | perfil | configuração do motor de recomendação | vida da conta |
| IP, user-agent | logs de auth | auditoria/segurança (cookie refresh_token) | 90 dias |
| Dados de pagamento (4 últimos dígitos, bandeira, nome no cartão) | Stripe | recibo/billing | 5 anos (lei tributária BR) |
| CPF do responsável financeiro | Stripe KYC | exigência regulatória Stripe | 5 anos |

### 1.2 Dados dos imóveis (vinculados ao anfitrião)

- Endereço completo, CEP, coordenadas geográficas
- Tipo, quantidade de quartos/banheiros/camas, amenities
- `id_do_anuncio` no Airbnb
- Histórico de preços sugeridos × aceitos (`AnalisePreco`)
- Histórico de reservas (se vier via integração Stays em F6.4)

**Classificação LGPD:** dados pessoais (endereço residencial de terceiros vive no imóvel cadastrado). **Não** tratamos dados de hóspedes dos anfitriões — nunca temos contato com eles.

### 1.3 Dados agregados/derivados

- Eventos públicos scraped (Eventim/Sympla/etc) — **não são dados pessoais**, são metadados de eventos.
- Recomendações de preço geradas pelo motor — dado interno, sem exposição a terceiros (exceto ao próprio anfitrião via dashboard).

---

## 2. Base legal para cada tratamento

| Tratamento | Base legal LGPD (Art. 7º/11º) |
|---|---|
| Armazenar dados do anfitrião e imóvel | **Execução de contrato** (art. 7º V) — indispensável para o serviço |
| Envio de e-mail transacional (confirmação, reset) | **Execução de contrato** (art. 7º V) |
| Envio de e-mail de marketing/newsletter | **Consentimento específico** (art. 7º I) — opt-in separado no perfil, ainda não implementado |
| Logs de IP/user-agent em login | **Legítimo interesse** (art. 7º IX) — segurança da própria plataforma |
| Integração Stays (push de preço) | **Consentimento explícito** (art. 7º I) — checkbox obrigatório no onboarding em F6.4 |
| Scraping de eventos públicos | Dados não-pessoais — LGPD não se aplica diretamente |
| Compartilhamento com Stripe, Mailersend, AWS, Railway | **Execução de contrato** + **cumprimento de obrigação regulatória** (billing) |

---

## 3. Direitos dos titulares (Art. 18)

Qualquer anfitrião pode solicitar, por e-mail para `privacidade@myurbanai.com` (a configurar no Mailersend), em até **15 dias corridos**:

1. **Acesso aos dados** — export JSON via endpoint administrativo (a implementar no painel F6.3)
2. **Correção** — edição via perfil já existe
3. **Anonimização/portabilidade** — processo manual via SQL (runbook a escrever)
4. **Exclusão da conta** — endpoint DELETE `/auth/:id` existe. A partir da exclusão, dados pessoais são apagados; metadados necessários para contabilidade/tributário são mantidos por 5 anos de forma anonimizada.
5. **Revogação de consentimento** — logout + DELETE da conta (consentimentos são atrelados à conta).
6. **Informação sobre compartilhamentos** — a lista da seção 4 abaixo é a fonte oficial.

### Template de resposta

Ver `docs/lgpd/template-resposta-lgpd.md` (a criar quando a primeira solicitação chegar).

---

## 4. Operadores / Subprocessadores

São terceiros que processam dados em nome da Urban AI. Cada um precisa de DPA assinado (ver seção 5).

| Operador | Propósito | Dados compartilhados | País de processamento |
|---|---|---|---|
| **Guilds (Gustavo Gouveia Macedo LTDA)** | operação contínua do produto (dev, infra, suporte) — CNPJ 44.361.255/0001-55 | acesso operacional ao backend, banco e ferramentas | Brasil |
| **Stripe Brasil** | processamento de pagamento recorrente + KYC | CPF, nome, email, 4 últimos dígitos do cartão | Brasil (transferência p/ EUA para fraud detection) |
| **SendGrid (Twilio)** | e-mail transacional — fluxos legados (recuperação de senha, alertas de imóveis, notificações de mapas) — `EmailService` | email, nome, conteúdo do e-mail (HTML/template) | EUA |
| **MailerSend** | e-mail transacional — fluxos novos (waitlist, parte do cron) — `MailerService` | email, nome, conteúdo do e-mail | EUA |
| **RapidAPI (3 hosts: airbnb19, airbnb45, airbnb-search)** | enriquecimento de dados públicos do Airbnb (disponibilidade, preço de mercado, get-price, checkout prefetch) | airbnbHostId, id_do_anuncio | EUA |
| **AWS (S3)** | armazenamento do data lake (eventos scraped, não PII) | nenhum dado pessoal direto | sa-east-1 (Brasil) |
| **Railway** | hosting do backend/front/DB | todos os dados persistidos (criptografados em repouso pelo provider) | EUA |
| **Upstash Redis** | filas BullMQ + cache | dados voláteis (tokens temporários, filas de job) | Global Edge |
| **Sentry** | observabilidade de erros | stack traces, IP, user-agent, userId | EUA |
| **Google Cloud** | Maps API (geocoding) + OAuth | endereços, email (no OAuth) | Multi-region |
| **Prefect Cloud** | orquestração do pipeline de dados | metadata de execução (nenhum PII) | EUA |
| **Stays** (planejado, F6.4) | canal de distribuição multi-platform | airbnbHostId, listingIds, preços sugeridos | Brasil |

### Transferência internacional

Stripe (parcial), SendGrid, Sentry, Railway, Upstash e Prefect processam dados nos EUA. A LGPD permite essa transferência (art. 33) se houver **garantias contratuais equivalentes**. Todos os DPAs abaixo cobrem essa cláusula.

AWS S3 está em região `sa-east-1` (Brasil). Stays.net (planejada, F6.4) processa no Brasil.

---

## 5. Data Processing Agreements (DPAs)

Status em 24/04/2026: **nenhum DPA assinado ainda**. Ação urgente em F9.2.

| Operador | Link do DPA padrão | Status | Onde arquivar |
|---|---|---|---|
| Guilds (Gustavo Gouveia Macedo LTDA) | DPA bilateral interno entre as PJs | ⬜ a redigir e assinar | `docs/lgpd/dpa/guilds.pdf` |
| Stripe | https://stripe.com/legal/dpa | ⬜ a assinar online no dashboard | `docs/lgpd/dpa/stripe.pdf` |
| SendGrid (Twilio) | https://www.twilio.com/legal/data-protection-addendum | ⬜ aceitar online no painel SendGrid (Settings → Legal) | `docs/lgpd/dpa/sendgrid.pdf` |
| MailerSend | https://www.mailersend.com/legal/dpa | ⬜ solicitar via suporte (DocuSign) | `docs/lgpd/dpa/mailersend.pdf` |
| RapidAPI | https://docs.rapidapi.com/docs/data-protection-agreement-dpa | ⬜ solicitar via account manager | `docs/lgpd/dpa/rapidapi.pdf` |
| AWS | https://aws.amazon.com/service-terms/ (inclui GDPR+LGPD addendum) | ⬜ aceitar no console AWS | `docs/lgpd/dpa/aws.pdf` |
| Railway | https://railway.app/legal/dpa | ⬜ solicitar via billing page | `docs/lgpd/dpa/railway.pdf` |
| Upstash | https://upstash.com/trust/dpa | ⬜ online | `docs/lgpd/dpa/upstash.pdf` |
| Sentry | https://sentry.io/legal/dpa | ⬜ online | `docs/lgpd/dpa/sentry.pdf` |
| Google Cloud | https://cloud.google.com/terms/data-processing-addendum | ⬜ aceitar no console | `docs/lgpd/dpa/gcp.pdf` |
| Stays | — negociar no contrato comercial | ⬜ pendente | `docs/lgpd/dpa/stays.pdf` |

Cronograma sugerido: concluir os 6 primeiros (Stripe, Mailersend, AWS, Railway, Upstash, Sentry) na **semana 7** (antes do beta fechado da F7). GCP e Stays podem aguardar para semana 8–9.

---

## 6. DPO (Encarregado de Dados)

**Decisão (05/05/2026):** o Encarregado **NÃO será o Gustavo**. Será uma pessoa terceira a designar — provavelmente serviço terceirizado de DPO-as-a-Service ou um advogado dedicado. Designação formal pendente antes do go-live público.

**Canal oficial do titular (LGPD art. 18):** `privacidade@myurbanai.com` — alias a criar no provedor de e-mail (MX já aponta para `notify.myurbanai.com`). Triagem operacional pelo Gustavo até a designação do DPO formal; resposta em até 15 dias corridos.

Enquanto o nome do DPO não estiver fixado, a página pública e o briefing jurídico devem mostrar o canal de e-mail e marcar a designação como "a divulgar". O nome e contato direto do DPO precisam ser publicados na Política de Privacidade assim que a designação for formalizada.

---

## 7. Medidas técnicas e organizacionais

Resumo do que já está em produção (referência: `docs/avaliacao-projeto-2026-04-16.md` + commits F5C.1 e F5C.2).

### Criptografia

- Em repouso: MySQL gerenciado pelo Railway (AES-256 pelo provider)
- Em trânsito: HTTPS obrigatório em todos os domínios com SSL Let's Encrypt
- Senhas: bcrypt(12) com per-user salt (desde F5C.2 item #7)
- Refresh tokens: hash SHA-256 persistido (o raw só vive no cookie httpOnly)

### Autenticação

- JWT via cookie httpOnly `Secure=true` + `SameSite=lax` em prod/staging
- Refresh rotation com detecção de reuso (revoga todas as sessões)
- Rate limit em `/auth/login`, `/auth/register`, `/auth/google` (5 req/min por IP)

### Transporte

- helmet + HSTS + CSP restringindo scripts a self + Stripe + Sentry + Google Maps
- CORS whitelist explícita (sem fallback `*`)

### Acesso

- Repo GitHub privado
- Env vars via Railway Secrets (rotação trimestral planejada em F5C.3)
- JWT_SECRET fail-fast se ausente — impossível subir com fallback inseguro

### Auditoria

- Sentry captura todas as exceções (environment tag por `APP_ENV`)
- Refresh tokens gravam user-agent + IP para rastreabilidade
- Push de preço em F6.4 (autônomo via Stays) vai gravar log auditável com timestamp, listingId, preço anterior/novo, origem (IA vs usuário)

### Backup

- Railway Pro: snapshot automático do MySQL com 7 dias de retenção
- Runbook de restore documentado em `docs/runbooks/backup-restore.md` (F5C.4 #6)

### Incidente

- Processo documentado em `docs/runbooks/incident-response.md` (a criar — próximo sprint)

---

## 8. Consentimento — pontos de captura

### No cadastro (implementado)

Marcação implícita ao aceitar termos. Precisa explicitar nos formulários:
- "Concordo com os Termos de Uso e a Política de Privacidade" — **a adicionar na landing e no /register** (F5A.1)

### No onboarding (F5A.2 em curso)

- Passo 3 já captura `airbnbHostId` — adicionar texto explicando o propósito.

### Ao conectar Stays (F6.4 — NOVO requisito LGPD)

Tela obrigatória com checkbox:

> Ao conectar sua conta Stays, você autoriza a Urban AI a:
>
> - Ler seus anúncios, calendário e histórico de reservas
> - Aplicar preços sugeridos pela nossa IA aos seus anúncios
> - Armazenar esse histórico pelo período da sua assinatura Urban AI
>
> Você pode desconectar a qualquer momento pelo painel, e todos os dados
> vinculados ao Airbnb serão apagados em até 15 dias.

Log: persistir `User.consents = [{ type: 'stays-connect', grantedAt, version: '2026-04-v1' }]`.

### E-mail de marketing

Opt-in separado no perfil (a implementar). Por padrão OFF.

---

## 9. Monitoramento de incidentes

ANPD (Autoridade Nacional de Proteção de Dados) exige notificação em "prazo razoável" se houver incidente de segurança que possa causar risco aos titulares. Na Urban AI:

- Detectar → Sentry/UptimeRobot → alerta no WhatsApp do Gustavo
- Avaliar risco em ≤ 24h (em quantos titulares o incidente impacta, dados expostos)
- Se risco alto → notificar ANPD em 72h (guia: https://www.gov.br/anpd)
- Notificar os titulares afetados diretamente

Playbook detalhado: `docs/runbooks/incident-response.md` (a criar).

---

## 10. Revisão desta política

Revisar trimestralmente. Próxima revisão programada: 24/07/2026.

Mudanças que obrigam revisão antecipada:
- Novo operador adicionado (ex.: Stays, Hostaway)
- Novo tipo de dado capturado (ex.: dados de hóspedes, se o produto evoluir)
- Mudança de base legal de algum tratamento
- Incidente de segurança

---

## Changelog

| Versão | Data | Autor | Mudança |
|---|---|---|---|
| 1.0 | 24/04/2026 | Gustavo + Claude | Criação inicial — resposta à F5C.4 item #4 |
| 1.1 | 05/05/2026 | Gustavo + Claude | Identificação da PJ controladora (MP IA Tecnologia, CNPJ, sede, foro Barueri); SendGrid corrigido (substitui menção indevida a Mailersend); DPO definido como pessoa terceira a designar; canal padronizado em `privacidade@myurbanai.com`; nota inicial sobre status societário do Gustavo. Disparada por leitura do contrato social registrado e pela montagem do briefing para o jurídico. |
| 1.2 | 05/05/2026 | Gustavo + Claude | Modelo Guilds-MP IA Tecnologia explicitado: Guilds opera o produto desde fev/2026 como prestadora da MP IA Tecnologia (Guilds adicionada como sub-operadora declarada). Gustavo reposicionado como COO+CTO operador via Guilds — não sócio, nem informalmente; expectativa de entrada futura como sócio sem acordo formal. Provedores de e-mail: SendGrid e MailerSend declarados em coexistência (ambos rodando, código com 2 módulos: `EmailService` e `MailerService`). RapidAPI confirmado em uso ativo em 3 hosts (airbnb19, airbnb45, airbnb-search) e adicionado à lista de operadores. Contato Gustavo padronizado em `gustavo.macedo@guilds.com.br`. Disparada por correção do próprio Gustavo. |

---

*Urban AI © 2026 · Documento interno confidencial · Referência para resposta a solicitações LGPD*
