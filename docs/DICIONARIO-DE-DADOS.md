# Dicionário de dados — Urban AI

> Documento de passagem. Tudo entre os marcadores `BEGIN GENERATED` e `END GENERATED` é **gerado a partir das entidades TypeORM** e não deve ser editado à mão; este cabeçalho é escrito à mão e pode ser editado.

## Como este documento é gerado e mantido

- Fonte da verdade: as entidades TypeORM em `urban-ai-backend-main/src/entities/` (e qualquer `*.entity.ts`). O gerador `urban-ai-backend-main/scripts/generate-data-dictionary.ts` carrega os metadados com `DataSource.buildMetadatas()` **sem conectar a nenhum banco** e lê os comentários das entidades com a API do TypeScript.
- Regerar (a partir de `urban-ai-backend-main/`): `npm run docs:data-dictionary`.
- Verificar sem escrever: `npm run docs:data-dictionary:check` (ou `npm run docs:data-dictionary -- --check`). Sai com código 1 se o arquivo estiver desatualizado, se existir tabela sem domínio ou se uma coluna da lista de PII tiver sumido. O teste Jest `src/docs/data-dictionary.spec.ts` roda essa verificação, então o CI barra um PR que muda uma entidade sem atualizar este arquivo.
- Comparar com um banco real: `npm run docs:data-dictionary -- --compare-db` (usa `DATABASE_URL` ou `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`) e lista tabelas/colunas que existem só no banco (migrations) ou só nas entidades.
- Ao criar uma tabela nova: inclua-a em `DOMAINS` no gerador; se ela tiver dado pessoal ou segredo, inclua a coluna em `PII_COLUMNS`.
- O schema real é definido pelas **migrations** (`urban-ai-backend-main/src/migrations/`, `synchronize: false`); o dicionário descreve as entidades. A divergência entre os dois é verificada por `--compare-db`.

## Domínios

**Usuários e autenticação** (`user`, `refresh_tokens`, `password_reset_tokens`, `email_confirmations`). Contas de anfitriões e administradores (`user.role`), com e-mail único, hash de senha (bcrypt), aceite de termos e e-mail verificado. Sessões usam refresh token guardado só como hash (`refresh_tokens`); redefinição de senha e confirmação de e-mail têm tabelas próprias com expiração e limite de tentativas.

**Assinatura e Stripe** (`plans`, `payment`). `plans` é o catálogo (cobrança por imóvel, ciclos mensal/trimestral/semestral/anual, IDs de preço do Stripe). `payment` é a projeção local da assinatura de cada usuário (cliente/assinatura Stripe, ciclo, imóveis contratados, trial) e guarda uma janela de eventos de webhook já processados para tolerar reenvio e desordem. Dados de cartão não ficam no banco.

**Imóveis, anúncios e Stays** (`list`, `addresses`, `stays_accounts`, `stays_listings`, `pricing_input_history`, `portfolio_property_settings`, `portfolio_action_runs`, `portfolio_action_items`, `portfolio_daily_price_overrides`, `airbnb_pricing_attempt_logs`). `list` é o anúncio (Airbnb) do anfitrião e `addresses` o endereço/geolocalização do imóvel, base de toda análise. `stays_accounts`/`stays_listings` ligam a conta do anfitrião ao gerenciador de canais Stays (token criptografado, consentimento registrado). As tabelas `portfolio_*` guardam estratégia por imóvel, execuções de ações em lote e preços diários definidos manualmente; `pricing_input_history` audita mudanças nos insumos de preço; `airbnb_pricing_attempt_logs` registra as tentativas de leitura de preço no Airbnb.

**Eventos, ingestão e deduplicação** (`events`, `event_sources`, `event_dedup_candidates`, `event_historical_multiplier`, `coverage_regions`, `external_listing`, `market_listing_observation`, `market_ingest_log`, `process_status`). `events` é o evento canônico (com hash e chaves normalizadas de deduplicação); `event_sources` guarda cada observação bruta por fonte que sustenta o evento; `event_dedup_candidates` é a fila de pares suspeitos de duplicidade para revisão. `event_historical_multiplier` guarda multiplicadores históricos reais por evento; `coverage_regions` define as regiões atendidas; `external_listing` é a base de comparáveis externos (Inside Airbnb e datasets licenciados) que alimenta o classificador e o mercado por bairro, com origem, data de coleta e licença por linha (ADR 0028); `market_listing_observation` guarda o histórico de preço/ocupação desses anúncios e `market_ingest_log` registra cada importação (quem, quando, licença); `process_status` é o estado do processo de ingestão.

**Precificação e análises** (`analise_preco`, `analise_endereco_evento`, `pricing_rule_configs`, `pricing_decision_snapshots`, `price_updates`, `price_snapshots`, `occupancy_history`, `event_intelligence_snapshots`, `event_property_impacts`, `event_proximity_features`, `ask_urban_messages`). `analise_preco` é a recomendação de preço por imóvel x evento (aceite, aplicação, verificação e resultado). `event_intelligence_snapshots`, `event_property_impacts`, `event_proximity_features` e `pricing_decision_snapshots` são snapshots versionados do motor de demanda e de decisão; `price_updates` é a trilha de preços aplicados (com idempotência e rollback); `price_snapshots` e `occupancy_history` formam o histórico para treino/backtest; `pricing_rule_configs` são as regras por imóvel; `analise_endereco_evento` guarda distância/tempo imóvel-evento; `ask_urban_messages` é o histórico do chat com a IA.

**Notificações e comunicação** (`notifications`, `push_subscriptions`, `push_deliveries`, `communication_events`, `user_communication_preferences`, `pricing_recommendation_digests`). Notificações in-app, assinaturas e entregas de Web Push, log de e-mails/pushes enviados (`communication_events`), preferências de comunicação por usuário e digests de recomendação de preço agendados.

**Administração e auditoria** (`admin_audit_logs`, `admin_job_runs`, `platform_costs`). Trilha de ações administrativas (com redação de segredos e e-mails antes de gravar), execuções de jobs agendados/manuais e custos da plataforma para o painel financeiro.

**Aquisição** (`waitlist`, `contact_submissions`). Lista de espera com convite e indicação, e formulário de contato comercial/suporte. Não estava na lista de domínios pedida, mas contém dados pessoais e por isso consta aqui.

**LGPD (transversal)**. Não há tabelas dedicadas à LGPD: o tema atravessa o schema. A exportação de dados do titular é montada por `src/auth/account-data.service.ts` (formato `urban-ai-data-export/v1`) a partir de `user`, `list`, `addresses`, `analise_preco`, `payment`, `stays_accounts` e `user_communication_preferences`, sem hash de senha, tokens, dados de cartão ou IDs internos do Stripe. A exclusão da própria conta existe (`AuthService.deleteOwnAccount`, LGPD art. 18, VI): re-autentica, cancela a assinatura no Stripe (aborta se falhar), desconecta a Stays, revoga as sessões e apaga o usuário, levando por cascade as tabelas ligadas a `user`. Ficam para trás nesse fluxo: `waitlist` e `contact_submissions` (sem FK para `user`, ligados só pelo e-mail) e `communication_events` (FK com `SET NULL`: a linha fica, com `recipient_email` preservado). `pricing_recommendation_digests` sai junto (FK com `CASCADE`). Anonimização em vez de exclusão e política de retenção por tabela: **a confirmar** (decisão jurídica pendente; ver `docs/lgpd/` e `npm run audit:lgpd`).

## Colunas sensíveis (resumo)

Categorias presentes no schema (detalhe coluna a coluna na seção gerada "Colunas sensíveis"):

- **E-mails**: `user.email`, `waitlist.email`, `contact_submissions.email`, `communication_events.recipient_email`, `pricing_recommendation_digests.recipient_email`. Texto puro no banco; mascarados nas saídas de auditoria/admin. Criptografia em repouso a nível de coluna: não existe (nível do provedor de banco: a confirmar).
- **Telefones**: `user.phone`, `waitlist.phone`. Texto puro.
- **Documentos (CPF/CNPJ)**: nenhuma coluna de documento foi encontrada no schema.
- **Senha**: `user.password`, bcrypt (12 rounds), `select: false`.
- **Tokens/segredos**: `refresh_tokens.tokenHash`, `password_reset_tokens.tokenHash` e `push_subscriptions.deviceSecretHash` guardam só SHA-256; `email_confirmations.code` guarda hash versionado; `stays_accounts.accessToken` é criptografado com AES-256-GCM; `waitlist.inviteToken` e as chaves Web Push (`push_subscriptions.p256dh`, `auth`) ficam em texto puro (proteção adicional a confirmar).
- **IP e user-agent**: `refresh_tokens`, `password_reset_tokens`, `waitlist`, `contact_submissions`, `price_updates`, `stays_accounts` (consentimento), `push_subscriptions`. Texto puro; retenção a confirmar.
- **Endereço/geolocalização de imóveis de anfitriões**: `addresses` (cep, logradouro, número, latitude, longitude), escopo por `user_id`.
- **Texto livre**: `contact_submissions.message`, `ask_urban_messages.content`.
- **Identificadores Stripe**: `payment.customerId`, `payment.subscriptionId` (opacos; sem dados de cartão no banco).



<!-- BEGIN GENERATED: data-dictionary (não edite à mão; rode npm run docs:data-dictionary) -->

## Resumo

- Tabelas (entidades TypeORM): **56**
- Colunas: **880**
- Chaves estrangeiras: **78**
- Tabela de controle de migrations (`migrations`) não é entidade e não consta aqui.

## Tabelas por domínio

| Domínio | Tabelas |
| --- | --- |
| Usuários e autenticação | `user`, `refresh_tokens`, `password_reset_tokens`, `email_confirmations` |
| Assinatura e Stripe | `plans`, `payment` |
| Imóveis, anúncios e Stays | `list`, `addresses`, `stays_accounts`, `stays_listings`, `pricing_input_history`, `portfolio_property_settings`, `portfolio_action_runs`, `portfolio_action_items`, `portfolio_daily_price_overrides`, `airbnb_pricing_attempt_logs` |
| Eventos, ingestão e deduplicação | `events`, `event_sources`, `event_dedup_candidates`, `event_historical_multiplier`, `coverage_regions`, `external_listing`, `market_listing_observation`, `market_ingest_log`, `process_status`, `event_reference`, `event_reference_votes`, `event_coverage_snapshots`, `event_reference_fetch_cache` |
| Precificação e análises | `analise_preco`, `analise_endereco_evento`, `pricing_rule_configs`, `pricing_decision_snapshots`, `price_updates`, `price_snapshots`, `occupancy_history`, `event_intelligence_snapshots`, `event_property_impacts`, `event_proximity_features`, `ask_urban_messages` |
| Notificações e comunicação | `notifications`, `push_subscriptions`, `push_deliveries`, `event_alert_dispatches`, `communication_events`, `user_communication_preferences`, `pricing_recommendation_digests` |
| Proprietários e relatório mensal | `property_owners`, `property_owner_properties`, `owner_reports`, `owner_report_links` |
| Administração e auditoria | `admin_audit_logs`, `admin_job_runs`, `platform_costs` |
| Aquisição (waitlist e contato) | `waitlist`, `contact_submissions` |

## Colunas sensíveis (PII e segredos) — inventário gerado

Lista curada em `PII_COLUMNS` (scripts/generate-data-dictionary.ts); o gerador falha se uma coluna listada deixar de existir. "a confirmar" = não verificado no código.

| Tabela | Coluna | Tipo de dado | Proteção |
| --- | --- | --- | --- |
| `addresses` | `cep` | endereço do imóvel do anfitrião | Texto puro; acesso restrito ao dono do imóvel (escopo por `user_id`). Incluído na exportação LGPD. |
| `addresses` | `latitude` | geolocalização do imóvel | Texto puro; escopo por `user_id`. |
| `addresses` | `logradouro` | endereço do imóvel do anfitrião | Texto puro; escopo por `user_id`. Incluído na exportação LGPD. |
| `addresses` | `longitude` | geolocalização do imóvel | Texto puro; escopo por `user_id`. |
| `addresses` | `numero` | endereço do imóvel do anfitrião | Texto puro; escopo por `user_id`. |
| `admin_audit_logs` | `after` | estado posterior (JSON) | Idem `before` (`redactForAudit`). |
| `admin_audit_logs` | `before` | estado anterior (JSON) | Passa por `redactForAudit` antes de gravar: segredos viram `[REDACTED]`, e-mails são mascarados, textos livres são omitidos. |
| `admin_audit_logs` | `metadata` | metadados da requisição (JSON) | Idem `before` (`redactForAudit`). |
| `ask_urban_messages` | `content` | texto livre do chat com a IA (pode conter dados pessoais) | Texto puro, escopo por `user_id`. Retenção: a confirmar. |
| `communication_events` | `recipient_device_id` | ID de dispositivo | Texto puro no banco; mascarado (`maskToken`) na API admin. |
| `communication_events` | `recipient_email` | e-mail do destinatário | Texto puro no banco; a API admin devolve mascarado (`maskEmail`). `failure_reason` passa por redação de e-mails/tokens na leitura. |
| `contact_submissions` | `email` | e-mail | Texto puro. Proteção adicional: a confirmar. |
| `contact_submissions` | `ipAddress` | IP | Texto puro, truncado a 80 caracteres no serviço. Retenção: a confirmar. |
| `contact_submissions` | `message` | texto livre (pode conter dados pessoais) | Texto puro. Proteção adicional: a confirmar. |
| `contact_submissions` | `name` | nome | Texto puro. Proteção adicional: a confirmar. |
| `contact_submissions` | `userAgent` | user-agent | Texto puro. Retenção: a confirmar. |
| `email_confirmations` | `code` | código de confirmação (hash) | Hash versionado vinculado ao usuário (`hashConfirmationCode`); texto puro apenas em registros legados. Tentativas limitadas (`attemptCount`, `lockedUntil`). |
| `owner_report_links` | `token_hash` | credencial de leitura (hash) | SHA-256 da parte aleatória do token; o token nunca é gravado. Expira (padrão 30 dias), revogável; apagado 30 dias depois de vencer/revogar (ADR 0027). |
| `owner_reports` | `payload_json` | desempenho financeiro dos imóveis (receita registrada, diária, ocupação) e nome do proprietário | JSON sem IDs internos, escopo por proprietário. Retenção: OWNER_REPORT_RETENTION_MONTHS (padrão 12) após o fim do mês (ADR 0027). |
| `password_reset_tokens` | `ip` | IP | Texto puro. Política de retenção: a confirmar. |
| `password_reset_tokens` | `tokenHash` | token de redefinição (hash) | Só o SHA-256 do token é persistido; expira (`expiresAt`) e é de uso único (`usedAt`). |
| `password_reset_tokens` | `userAgent` | user-agent | Texto puro. Política de retenção: a confirmar. |
| `payment` | `customerId` | ID de cliente Stripe | Identificador opaco (cus_...), texto puro; sem dados de cartão no banco (cartões ficam no Stripe). Fora da exportação LGPD. |
| `payment` | `subscriptionId` | ID de assinatura Stripe | Identificador opaco (sub_...), texto puro. Fora da exportação LGPD. |
| `price_updates` | `ip` | IP | Texto puro (trilha de quem aplicou preço). Retenção: a confirmar. |
| `price_updates` | `userAgent` | user-agent | Texto puro. Retenção: a confirmar. |
| `pricing_recommendation_digests` | `recipient_email` | e-mail do destinatário | Texto puro. Proteção adicional: a confirmar. |
| `pricing_recommendation_digests` | `recipient_name` | nome do destinatário | Texto puro. Proteção adicional: a confirmar. |
| `property_owners` | `consent_ip` | IP (declaração de base legal do anfitrião) | Texto puro (`req.ip`), truncado a 64 caracteres. Prova de consentimento: fica enquanto o proprietário existir (ADR 0027). |
| `property_owners` | `email` | e-mail de terceiro (proprietário do imóvel) | Texto puro, em minúsculas, único por anfitrião. Só recebe o relatório mensal, com descadastro. Mesma retenção do nome (ADR 0027). |
| `property_owners` | `name` | nome de terceiro (proprietário do imóvel) | Texto puro, escopo por `user_id` do anfitrião (CASCADE). Retenção: some com a conta do anfitrião ou quando ele remove o proprietário (ADR 0027). |
| `property_owners` | `unsubscribe_ref` | referência opaca do descadastro | Aleatório de 128 bits, inútil sem a assinatura HMAC do servidor. Trocada quando o e-mail muda. |
| `push_subscriptions` | `auth` | segredo de autenticação Web Push | Texto puro. Proteção adicional: a confirmar. |
| `push_subscriptions` | `deviceSecretHash` | segredo do dispositivo (hash) | Só o SHA-256 do segredo é persistido. |
| `push_subscriptions` | `endpoint` | endpoint Web Push | Texto puro (necessário para enviar o push); há `endpointHash` SHA-256 para busca/deduplicação. |
| `push_subscriptions` | `p256dh` | chave pública Web Push | Texto puro. Proteção adicional: a confirmar. |
| `push_subscriptions` | `userAgent` | user-agent | Texto puro. Retenção: a confirmar. |
| `refresh_tokens` | `ip` | IP | Texto puro. Política de retenção: a confirmar. |
| `refresh_tokens` | `tokenHash` | token de sessão (hash) | Só o SHA-256 do refresh token é persistido; o valor bruto vai ao cliente em cookie httpOnly. Revogável (`revokedAt`). |
| `refresh_tokens` | `userAgent` | user-agent | Texto puro. Política de retenção: a confirmar. |
| `stays_accounts` | `accessToken` | token de API de terceiro (Stays) | Criptografado em repouso com AES-256-GCM (transformer `staysTokenTransformer`, prefixo `enc:v1:`); chave em `STAYS_TOKEN_ENCRYPTION_KEY`, obrigatória em production/staging. Fora da exportação LGPD. |
| `stays_accounts` | `clientId` | identificador de credencial (Stays) | Texto puro. Proteção adicional: a confirmar. |
| `stays_accounts` | `consentIp` | IP (prova de consentimento) | Texto puro, truncado a 64 caracteres no serviço. Retenção: a confirmar. |
| `stays_accounts` | `consentUserAgent` | user-agent (prova de consentimento) | Texto puro. Retenção: a confirmar. |
| `user` | `company` | nome de empresa | Texto puro, opcional. Proteção adicional: a confirmar. |
| `user` | `email` | e-mail | Texto puro no banco (índice único). Mascarado (`maskEmail`) no log de auditoria admin e no log de comunicações; incluído na exportação LGPD do titular. Criptografia em repouso: a confirmar (nível do provedor de banco). |
| `user` | `password` | hash de senha | Esquema v2 (`pw:v2:` + bcrypt 12 rounds da senha, calculado só no servidor; senha limitada a 72 bytes UTF-8 ao definir; ADR 0025). Hashes legados (bcrypt do SHA-256 que o front antigo enviava) são migrados para v2 no login com a senha em claro. `select: false` + `@Exclude()`; nunca na exportação LGPD. |
| `user` | `phone` | telefone | Texto puro, opcional. Proteção adicional: a confirmar. |
| `user` | `username` | nome | Texto puro. Incluído na exportação LGPD (campos exatos em `account-data.service.ts`). Proteção adicional: a confirmar. |
| `waitlist` | `email` | e-mail | Texto puro. Proteção adicional: a confirmar. |
| `waitlist` | `inviteToken` | token de convite | Texto puro no banco (diferente de refresh/reset, que usam hash); expira (`inviteTokenExpiresAt`) e é limpo ao ser usado. Hash em repouso: a confirmar. |
| `waitlist` | `name` | nome | Texto puro. Proteção adicional: a confirmar. |
| `waitlist` | `phone` | telefone | Texto puro. Proteção adicional: a confirmar. |
| `waitlist` | `signupIp` | IP | Texto puro. Retenção: a confirmar. |
| `waitlist` | `userAgent` | user-agent | Texto puro. Retenção: a confirmar. |

**Candidatas por nome ainda não classificadas** (heurística; revisar e mover para `PII_COLUMNS` ou aceitar como não sensíveis):

`admin_job_runs.name`, `communication_events.template_name`, `notifications.send_email`, `owner_reports.email_status`, `owner_reports.email_attempts`, `owner_reports.email_sent_at`, `owner_reports.email_failure_reason`, `plans.name`, `platform_costs.name`, `pricing_recommendation_digests.wants_email`, `push_subscriptions.endpointHash`, `stays_accounts.tokenExpiresAt`, `user.email_verified_at`, `user_communication_preferences.email_pricing`, `user_communication_preferences.onboarding_emails`, `waitlist.inviteTokenExpiresAt`

## Tabelas

### `addresses`

- Entidade: `Address` (`src/entities/addresses.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `cep` | `cep` | varchar(9) | não |  | IDX |  |
| `numero` | `numero` | varchar(20) | não |  |  |  |
| `logradouro` | `logradouro` | varchar(255) | sim |  |  |  |
| `bairro` | `bairro` | varchar(255) | sim |  |  |  |
| `cidade` | `cidade` | varchar(255) | sim |  | IDX |  |
| `estado` | `estado` | varchar(2) | sim |  |  |  |
| `latitude` | `latitude` | decimal(10,8) | sim |  |  |  |
| `longitude` | `longitude` | decimal(11,8) | sim |  |  |  |
| `metro_distance_km` | `metroDistance` | float | sim |  |  |  |
| `ativo` | `ativo` | tinyint | não | true |  |  |
| `quota_paused_at` | `quotaPausedAt` | timestamp | sim |  |  | Interno (sem @ApiProperty de propósito: não altera o contrato OpenAPI). Quando o imóvel foi pausado por exceder a cota do plano (downgrade/fim de assinatura). Pausado = ativo=false + este campo; nunca é apagado e volta quando a cota sobe. |
| `created_at` | `created_at` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updated_at` | `updated_at` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `analisado` | `analisado` | varchar(255) | não | pending |  |  |
| `idAlertAirb` | `idAlertAirb` | varchar(255) | não | no_id |  |  |
| `list_id` | `list` | varchar(36) | sim |  | IDX, FK | Relacionamentos |
| `user_id` | `user` | varchar(36) | sim |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `list` | `list` | list_id | NO ACTION | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_41aa769237c813f7ffebd0b26c`: `cep`
- `IDX_645885a28d9d34ba539fdda6a8`: `cidade`
- `IDX_ef4dab2d4e8cbfa5b9067c275d`: `list_id`, `user_id`

### `admin_audit_logs`

- Entidade: `AdminAuditLog` (`src/entities/admin-audit-log.entity.ts`)
- Domínio: Administração e auditoria

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `actorUserId` | `actorUserId` | varchar(36) | sim |  | IDX |  |
| `action` | `action` | varchar(96) | não |  | IDX |  |
| `entityType` | `entityType` | varchar(64) | não |  | IDX |  |
| `entityId` | `entityId` | varchar(128) | sim |  | IDX |  |
| `before` | `before` | text | sim |  |  |  |
| `after` | `after` | text | sim |  |  |  |
| `metadata` | `metadata` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |

Índices e unicidades:

- `IDX_13cafaf0d4501d0346888efc66`: `action`, `createdAt`
- `IDX_c18e23847f6d4509d582539419`: `actorUserId`, `createdAt`
- `IDX_ef16f51cceb84eb854eb3a65db`: `entityType`, `entityId`

### `admin_job_runs`

- Entidade: `AdminJobRun` (`src/entities/admin-job-run.entity.ts`)
- Domínio: Administração e auditoria

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(64) | não |  | IDX |  |
| `status` | `status` | varchar(16) | não | running | IDX |  |
| `triggeredByUserId` | `triggeredByUserId` | varchar(36) | sim |  | IDX |  |
| `startedAt` | `startedAt` | datetime | não |  | IDX |  |
| `finishedAt` | `finishedAt` | datetime | sim |  |  |  |
| `durationMs` | `durationMs` | int | sim |  |  |  |
| `result` | `result` | text | sim |  |  |  |
| `errorMessage` | `errorMessage` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_5463c2c50865e5e15696bba267`: `triggeredByUserId`, `startedAt`
- `IDX_56441aa94ab276a49793f48570`: `status`, `startedAt`
- `IDX_b35edfbc3c2002906ac9e02e5f`: `name`, `startedAt`

### `airbnb_pricing_attempt_logs`

- Entidade: `AirbnbPricingAttemptLog` (`src/entities/airbnb-pricing-attempt-log.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `listingId` | `listingId` | varchar(128) | não |  | IDX |  |
| `user_id` | `userId` | varchar(36) | sim |  | IDX, FK |  |
| `list_id` | `listId` | varchar(36) | sim |  | IDX, FK |  |
| `address_id` | `addressId` | varchar(36) | sim |  | IDX, FK |  |
| `checkIn` | `checkIn` | date | não |  | IDX |  |
| `checkOut` | `checkOut` | date | não |  | IDX |  |
| `source` | `source` | varchar(64) | não | airbnb_headless | IDX |  |
| `status` | `status` | varchar(32) | não | pending | IDX |  |
| `reason` | `reason` | varchar(255) | sim |  | IDX |  |
| `durationMs` | `durationMs` | int | sim |  |  |  |
| `priceTotal` | `priceTotal` | decimal(12,2) | sim |  |  |  |
| `dailyPrice` | `dailyPrice` | decimal(12,2) | sim |  |  |  |
| `currency` | `currency` | varchar(3) | não | BRL |  |  |
| `finalUrl` | `finalUrl` | text | sim |  |  |  |
| `metadata` | `metadata` | text | sim |  |  |  |
| `startedAt` | `startedAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `finishedAt` | `finishedAt` | datetime | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | SET NULL | NO ACTION |
| many-to-one | `list` | `list` | list_id | SET NULL | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_429a3f689c47363ca077bdd5a5`: `user_id`, `startedAt`
- `IDX_53bd17befa6090163c5f4efa7c`: `status`, `reason`, `startedAt`
- `IDX_818b47c4ee7f6856d5e40d4355`: `list_id`, `startedAt`
- `IDX_87f1a470222e48a31e614fd872`: `status`, `startedAt`
- `IDX_dcee3ab36549ffb58305d9bed0`: `listingId`, `checkIn`, `checkOut`
- `IDX_e01158a8546e35187c877d7b59`: `source`, `startedAt`
- `IDX_ee57ac91ea8430f870472681cc`: `address_id`, `startedAt`

### `analise_endereco_evento`

- Entidade: `AnaliseEnderecoEvento` (`src/entities/AnaliseEnderecoEvento.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `distancia_metros` | `distanciaMetros` | int | não |  |  |  |
| `duração_minutos` | `duraçãoSegundos` | int | não |  |  |  |
| `transport_mode` | `transportMode` | varchar(50) | não |  |  |  |
| `enviado` | `enviado` | tinyint | não |  |  |  |
| `criado_em` | `criadoEm` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `atualizado_em` | `atualizadoEm` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `evento_id` | `evento` | varchar(36) | não |  | IDX, FK |  |
| `endereco_id` | `endereco` | varchar(36) | não |  | IDX, FK |  |
| `usuario_proprietario_id` | `usuarioProprietario` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `evento` | `events` | evento_id | CASCADE | NO ACTION |
| many-to-one | `endereco` | `addresses` | endereco_id | CASCADE | NO ACTION |
| many-to-one | `usuarioProprietario` | `user` | usuario_proprietario_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_ad8af3fbf1b0c92ae855c42ae4`: `evento_id`, `endereco_id`, `usuario_proprietario_id`

### `analise_preco`

- Entidade: `AnalisePreco` (`src/entities/AnalisePreco.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `distancia_sua_propriedade` | `distanciaSuaPropriedade` | float | não |  |  | --- Resultados do cálculo --- |
| `distancia_propriedade_referencia` | `distanciaPropriedadeReferencia` | float | não |  |  |  |
| `preco_sugerido` | `precoSugerido` | decimal(10,2) | não |  |  |  |
| `seu_preco_atual` | `seuPrecoAtual` | decimal(10,2) | não |  |  |  |
| `diferenca_percentual` | `diferencaPercentual` | decimal(5,2) | não |  |  |  |
| `recomendacao` | `recomendacao` | varchar(255) | não |  |  |  |
| `aceito` | `aceito` | tinyint | não | false |  |  |
| `status` | `status` | varchar(24) | não | suggested |  |  |
| `aceito_em` | `aceitoEm` | timestamp | sim |  |  |  |
| `rejeitado_em` | `rejeitadoEm` | timestamp | sim |  |  |  |
| `expirado_em` | `expiradoEm` | timestamp | sim |  |  |  |
| `preco_aplicado` | `precoAplicado` | decimal(10,2) | sim |  |  | Preço REAL que o anfitrião aplicou após a sugestão (centavos × 100 = R$). Pode ser igual ao precoSugerido (aceitou cego) ou diferente (ajustou). NULL enquanto o anfitrião não confirmar. Esse campo + `aceito=true` + `criadoEm` formam o ground truth do MAPE real do motor — sem ele, não dá para validar a promessa "+30% receita". Ver F6.1 Tier 3 do roadmap. |
| `aplicado_em` | `aplicadoEm` | timestamp | sim |  |  | Quando o anfitrião confirmou ter aplicado (data de aceite real). |
| `origem_aplicacao` | `origemAplicacao` | varchar(32) | sim |  |  | Origem da aplicação: - 'manual_dashboard': anfitrião marcou no nosso dashboard, aplicou no canal sozinho - 'manual_off_platform': anfitrião disse que aplicou em outro lugar (auto-declaração) - 'stays_auto': pushado automaticamente via integração Stays (F6.4) - 'stays_user_accepted': pushado via Stays a partir da aceitação no dashboard |
| `reserva_status` | `reservaStatus` | varchar(24) | sim |  |  |  |
| `receita_real` | `receitaReal` | decimal(10,2) | sim |  |  |  |
| `noites_reservadas` | `noitesReservadas` | int | sim |  |  |  |
| `resultado_registrado_em` | `resultadoRegistradoEm` | timestamp | sim |  |  |  |
| `feedback_observacao` | `feedbackObservacao` | text | sim |  |  |  |
| `verification_status` | `verificationStatus` | varchar(24) | sim |  |  |  |
| `verification_checked_at` | `verificationCheckedAt` | timestamp | sim |  |  |  |
| `verified_applied_at` | `verifiedAppliedAt` | timestamp | sim |  |  |  |
| `observed_price` | `observedPrice` | decimal(10,2) | sim |  |  |  |
| `verification_source` | `verificationSource` | varchar(48) | sim |  |  |  |
| `verification_error` | `verificationError` | text | sim |  |  |  |
| `shadow_v2_preco` | `shadowV2Preco` | decimal(10,2) | sim |  |  | Preço que o motor v2 calculou em sombra (`PRICING_ENGINE_V2=shadow`) para esta mesma noite/evento, ao lado do v1 em `precoSugerido`. NULL quando o v2 não rodou. Só para comparação interna (view admin v1 x v2); nunca é mostrado ao anfitrião. |
| `shadow_v2_versao` | `shadowV2Versao` | varchar(32) | sim |  |  |  |
| `motivo_ia` | `motivo_ia` | text | sim |  |  | --- IA Reasoning --- |
| `criado_em` | `criadoEm` | datetime | não | CURRENT_TIMESTAMP(6) |  | --- Auditoria --- |
| `endereco_id` | `endereco` | varchar(36) | não |  | FK | 📌 Endereço principal (sua propriedade) |
| `evento_id` | `evento` | varchar(36) | não |  | FK | 📌 Evento relacionado |
| `usuario_proprietario_id` | `usuarioProprietario` | varchar(36) | não |  | FK | 📌 Usuário dono da propriedade |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `endereco` | `addresses` | endereco_id | CASCADE | NO ACTION |
| many-to-one | `evento` | `events` | evento_id | CASCADE | NO ACTION |
| many-to-one | `usuarioProprietario` | `user` | usuario_proprietario_id | CASCADE | NO ACTION |

### `ask_urban_messages`

- Entidade: `AskUrbanMessage` (`src/entities/ask-urban-message.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `conversationId` | `conversationId` | varchar(64) | não |  | IDX |  |
| `role` | `role` | varchar(16) | não |  |  |  |
| `content` | `content` | text | não |  |  |  |
| `citations` | `citations` | text | sim |  |  |  |
| `feedback` | `feedback` | varchar(8) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_3e14f5cfeacfb03037b56a5298`: `conversationId`
- `IDX_cebbbcc38dbb8b6a7370874e33`: `user_id`, `createdAt`

### `communication_events`

- Entidade: `CommunicationEvent` (`src/entities/communication-event.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | sim |  | IDX, FK |  |
| `channel` | `channel` | varchar(24) | não |  | IDX |  |
| `status` | `status` | varchar(24) | não |  | IDX |  |
| `kind` | `kind` | varchar(96) | sim |  | IDX |  |
| `template_name` | `templateName` | varchar(120) | sim |  |  |  |
| `recipient_email` | `recipientEmail` | varchar(254) | sim |  |  |  |
| `recipient_device_id` | `recipientDeviceId` | varchar(64) | sim |  |  |  |
| `subject` | `subject` | varchar(220) | sim |  |  |  |
| `title` | `title` | varchar(220) | sim |  |  |  |
| `provider` | `provider` | varchar(64) | sim |  |  |  |
| `provider_message_id` | `providerMessageId` | varchar(160) | sim |  |  |  |
| `failure_reason` | `failureReason` | text | sim |  |  |  |
| `metadata_json` | `metadataJson` | text | sim |  |  |  |
| `correlation_id` | `correlationId` | varchar(120) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_communication_events_channel_status`: `channel`, `status`, `createdAt`
- `IDX_communication_events_created`: `createdAt`
- `IDX_communication_events_kind_created`: `kind`, `createdAt`
- `IDX_communication_events_user_created`: `user_id`, `createdAt`

### `contact_submissions`

- Entidade: `ContactSubmission` (`src/entities/contact-submission.entity.ts`)
- Domínio: Aquisição (waitlist e contato)

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(160) | não |  |  |  |
| `email` | `email` | varchar(254) | não |  | IDX |  |
| `subject` | `subject` | varchar(220) | não |  |  |  |
| `message` | `message` | text | não |  |  |  |
| `source` | `source` | varchar(80) | não | public-contact |  |  |
| `status` | `status` | varchar(32) | não | new | IDX |  |
| `category` | `category` | varchar(32) | não | support |  |  |
| `severity` | `severity` | varchar(8) | não | P2 |  |  |
| `dueAt` | `dueAt` | datetime | sim |  |  |  |
| `resolvedAt` | `resolvedAt` | datetime | sim |  |  |  |
| `assignedOwner` | `assignedOwner` | varchar(160) | sim |  |  |  |
| `notes` | `notes` | text | sim |  |  |  |
| `ipAddress` | `ipAddress` | varchar(80) | sim |  |  |  |
| `userAgent` | `userAgent` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_0328b0ec84cf6e08b4d7a78fe3`: `email`
- `IDX_61fee86357fec766cbec05ea78`: `status`, `createdAt`

### `coverage_regions`

- Entidade: `CoverageRegion` (`src/entities/coverage-region.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Região de cobertura geográfica do motor de eventos (F6.2 Plus + escala). Define onde o motor "enxerga" eventos. Um evento entra no pricing se: 1. Está dentro do raio de algum Address ativo (default 80km), OU 2. Está dentro de alguma `CoverageRegion` com status `active` ou `bootstrap` Caso contrário, é marcado `outOfScope=true` (preservado no DB pra auditoria e reativação futura, mas ignorado pelo motor + Gemini). Modelo "Híbrido": - **Default automático**: cobertura segue imóveis cadastrados → quando o primeiro anfitrião do Rio cadastrar imóvel, eventos do Rio que entrarem automaticamente passam a ser válidos - **Override admin**: admin pode marcar regiões manualmente para: - `bootstrap`: cobrir antes de ter imóvel (estratégia de pré-aquecimento de dataset antes de abrir cidade) - `active`: forçar cobertura (ex: Grande SP enquanto temos poucos imóveis) - `inactive`: parar coleta numa região que não dá ROI Geometria: aceita 2 formatos exclusivos: - **Centro + raio** (mais simples): `centerLat`, `centerLng`, `radiusKm` - **Bounding box** (mais preciso): `minLat`, `maxLat`, `minLng`, `maxLng` O `CoverageService` aceita ambos.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(128) | não |  |  | Nome humano. Ex: "Grande São Paulo", "Rio Metropolitano", "Belo Horizonte". |
| `status` | `status` | varchar(16) | não | active | IDX | Status: - `active`: cobre eventos agora; eventos dentro entram no motor - `bootstrap`: cobre antes de ter imóvel cadastrado (pré-aquecimento de dataset; ainda assim aceita eventos pra construir histórico) - `inactive`: parou de cobrir; eventos novos viram outOfScope (mas históricos ficam no DB) |
| `centerLat` | `centerLat` | decimal(10,8) | sim |  |  | ============== Geometria modo 1: centro + raio ============== |
| `centerLng` | `centerLng` | decimal(11,8) | sim |  |  |  |
| `radiusKm` | `radiusKm` | int | sim |  |  | Raio em km. Pra cobertura padrão: 80km. |
| `minLat` | `minLat` | decimal(10,8) | sim |  |  | ============== Geometria modo 2: bounding box ============== |
| `maxLat` | `maxLat` | decimal(10,8) | sim |  |  |  |
| `minLng` | `minLng` | decimal(11,8) | sim |  |  |  |
| `maxLng` | `maxLng` | decimal(11,8) | sim |  |  |  |
| `notes` | `notes` | text | sim |  |  | Notas internas — justificativa, plano de expansão, links. |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_96237a34b68fb7236d8fe6af74`: `status`

### `email_confirmations`

- Entidade: `EmailConfirmation` (`src/entities/EmailConfirmation.ts`)
- Domínio: Usuários e autenticação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `code` | `code` | varchar(255) | não |  |  | hash versionado; plaintext somente para compatibilidade legada |
| `purpose` | `purpose` | varchar(64) | não | email_confirmation |  |  |
| `expiresAt` | `expiresAt` | datetime | não |  |  | expiração do código |
| `confirmed` | `confirmed` | tinyint | não | false |  | se o código já foi usado |
| `attemptCount` | `attemptCount` | int | não | 0 |  |  |
| `lockedUntil` | `lockedUntil` | datetime | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `userId` | `user` | varchar(36) | sim |  | FK | Relação com o usuário (sem precisar alterar User) |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | userId | CASCADE | NO ACTION |

### `event_alert_dispatches`

- Entidade: `EventAlertDispatch` (`src/entities/event-alert-dispatch.entity.ts`)
- Domínio: Notificações e comunicação
- Descrição: Registro de "este anfitrião já foi avisado deste evento" (push de evento relevante). A chave única (user_id, event_id) é a idempotência: duas réplicas ou duas execuções do job nunca avisam o mesmo anfitrião duas vezes. `sent_on` (dia de São Paulo) e `property_id` sustentam os limites diários por imóvel e por anfitrião.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | não |  | UNIQUE (composto), IDX, FK |  |
| `event_id` | `eventId` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `property_id` | `propertyId` | varchar(36) | não |  | IDX | Imóvel (addresses.id) pelo qual o anfitrião foi avisado: o mais próximo do evento. |
| `sent_on` | `sentOn` | varchar(10) | não |  | IDX | Dia (São Paulo, `YYYY-MM-DD`) em que o aviso foi gerado; base dos limites diários. |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| many-to-one | `event` | `events` | event_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_event_alert_dispatches_property_day`: `property_id`, `sent_on`
- `IDX_event_alert_dispatches_user_day`: `user_id`, `sent_on`
- `UQ_event_alert_dispatches_user_event` (UNIQUE): `user_id`, `event_id`

### `event_coverage_snapshots`

- Entidade: `EventCoverageSnapshot` (`src/entities/event-coverage-snapshot.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Série histórica diária de recall e precisão (ADR 0026), uma linha por (dia, janela, dimensão, valor). `past30` = referências aprovadas dos últimos 30 dias já realizados (recall "de verdade"); `next90` = as dos próximos 90 dias (antecipação) e é onde fica a precisão da amostra de eventos do banco. Idempotente por dia: reexecutar reescreve.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `snapshotDate` | `snapshotDate` | varchar(10) | não |  | UNIQUE (composto), IDX | Dia (São Paulo) da medição. |
| `scope` | `scope` | varchar(12) | não |  | UNIQUE (composto) |  |
| `dimension` | `dimension` | varchar(12) | não |  | UNIQUE (composto) |  |
| `dimensionValue` | `dimensionValue` | varchar(120) | não | all | UNIQUE (composto) |  |
| `referenceTotal` | `referenceTotal` | int | não | 0 |  |  |
| `referenceMatched` | `referenceMatched` | int | não | 0 |  |  |
| `recallPct` | `recallPct` | decimal(5,2) | sim |  |  |  |
| `precisionSample` | `precisionSample` | int | sim |  |  |  |
| `precisionConfirmed` | `precisionConfirmed` | int | sim |  |  |  |
| `precisionRefuted` | `precisionRefuted` | int | sim |  |  |  |
| `precisionPct` | `precisionPct` | decimal(5,2) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_event_coverage_snapshots_date`: `snapshotDate`
- `UQ_event_coverage_snapshots_key` (UNIQUE): `snapshotDate`, `scope`, `dimension`, `dimensionValue`

### `event_dedup_candidates`

- Entidade: `EventDedupCandidate` (`src/entities/event-dedup-candidate.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `canonicalEventId` | `canonicalEventId` | varchar(36) | não |  | UNIQUE (composto), IDX, FK |  |
| `duplicateEventId` | `duplicateEventId` | varchar(36) | não |  | UNIQUE (composto), IDX, FK |  |
| `status` | `status` | varchar(16) | não | pending | IDX |  |
| `confidenceBand` | `confidenceBand` | varchar(16) | não | medium | IDX |  |
| `score` | `score` | decimal(5,4) | não |  |  |  |
| `reason` | `reason` | varchar(255) | não |  |  |  |
| `signals` | `signals` | text | sim |  |  |  |
| `source` | `source` | varchar(64) | sim |  |  |  |
| `sourceId` | `sourceId` | varchar(128) | sim |  |  |  |
| `reviewedByUserId` | `reviewedByUserId` | varchar(36) | sim |  |  |  |
| `reviewedAt` | `reviewedAt` | datetime | sim |  |  |  |
| `reviewReason` | `reviewReason` | varchar(255) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `canonicalEvent` | `events` | canonicalEventId | CASCADE | NO ACTION |
| many-to-one | `duplicateEvent` | `events` | duplicateEventId | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_013d6f814e9971ea57a8429ebe`: `duplicateEventId`
- `IDX_0e8cb2778ed1f35748b11fafd1`: `status`, `confidenceBand`
- `IDX_5afc26ab2c80d0c97fd0c4386e`: `canonicalEventId`
- `IDX_a902a737521fe659b0a20b9522` (UNIQUE): `canonicalEventId`, `duplicateEventId`

### `event_historical_multiplier`

- Entidade: `EventHistoricalMultiplier` (`src/entities/event-historical-multiplier.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: IA-3b — âncora histórica de eventos recorrentes. Guarda, por evento canônico (chave = nome normalizado, ex.: "ccxp", "lollapalooza brasil", "the town", "virada cultural"), o que já se sabe das edições passadas: público realizado, ocupação real e o multiplicador que funcionou. Assim uma edição NOVA (CCXP 2026) herda a âncora das anteriores em vez de depender só do chute do LLM. Fontes de população: - `wikidata` — importador SPARQL (público P1110 de edições anteriores). - `news` — extração de notícias (Firecrawl), quando ligado. - `feedback` — o próprio loop de resultado (ocupação/multiplicador real), que ao longo das temporadas vira a fonte dominante.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `canonicalName` | `canonicalName` | varchar(255) | não |  | UNIQUE | Nome normalizado do evento recorrente — chave de junção com events.normalizedName. |
| `displayName` | `displayName` | varchar(255) | sim |  |  | Nome legível (última edição vista). |
| `realAttendance` | `realAttendance` | int | sim |  |  | Público realizado (mediana/máx das edições conhecidas). |
| `realOccupancy` | `realOccupancy` | float | sim |  |  | Ocupação real média observada nos imóveis durante o evento (0..1). |
| `realMultiplier` | `realMultiplier` | float | sim |  |  | Multiplicador de preço que efetivamente funcionou (do feedback loop). |
| `avgDemandScore` | `avgDemandScore` | float | sim |  |  | Média do eventDemandScore observado. |
| `sampleSize` | `sampleSize` | int | não | 0 |  | Nº de observações agregadas (edições/amostras). |
| `lastYear` | `lastYear` | int | sim |  |  | Ano da edição mais recente considerada. |
| `source` | `source` | varchar(16) | não | wikidata |  | Origem predominante do dado: 'wikidata' \| 'news' \| 'feedback'. |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_0183b1234c3984b14b1e8f7730` (UNIQUE): `canonicalName`

### `event_intelligence_snapshots`

- Entidade: `EventIntelligenceSnapshot` (`src/entities/event-intelligence-snapshot.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `generatedAt` | `generatedAt` | datetime | não |  | IDX |  |
| `jobRunId` | `jobRunId` | varchar(64) | sim |  | IDX |  |
| `metricVersion` | `metricVersion` | varchar(32) | não | event-demand-v0 |  |  |
| `modelVersion` | `modelVersion` | varchar(32) | não | stub-contract-v0 |  |  |
| `eventDemandScore` | `eventDemandScore` | decimal(5,2) | sim |  | IDX |  |
| `eventRevenuePotentialCents` | `eventRevenuePotentialCents` | int | sim |  |  |  |
| `demandRadiusKm` | `demandRadiusKm` | decimal(6,2) | sim |  |  |  |
| `sourceReliabilityScore` | `sourceReliabilityScore` | decimal(5,2) | sim |  |  |  |
| `sourceFreshnessHours` | `sourceFreshnessHours` | decimal(8,2) | sim |  |  |  |
| `confidence` | `confidence` | varchar(16) | não | low | IDX |  |
| `expectedAttendance` | `expectedAttendance` | int | sim |  |  |  |
| `venueType` | `venueType` | varchar(64) | sim |  |  |  |
| `category` | `category` | varchar(100) | sim |  |  |  |
| `leadTimeDays` | `leadTimeDays` | int | sim |  |  |  |
| `overlapEventsCount` | `overlapEventsCount` | int | não | 0 |  |  |
| `supplyCompressionScore` | `supplyCompressionScore` | decimal(5,2) | sim |  |  |  |
| `interpretation` | `interpretation` | text | sim |  |  |  |
| `drivers` | `drivers` | text | sim |  |  |  |
| `hotRegions` | `hotRegions` | text | sim |  |  |  |
| `riskFlags` | `riskFlags` | text | sim |  |  |  |
| `dataQualityFlags` | `dataQualityFlags` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `event_id` | `event` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `event` | `events` | event_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_9b47d93959df6078658c993c04`: `eventDemandScore`
- `IDX_acb106f8b42148c22486f05ecc`: `jobRunId`, `event_id`
- `IDX_cf52a52fac246b44ed7c89e901`: `event_id`, `generatedAt`
- `IDX_e646f8d931aeda007fef5e8f2d`: `confidence`, `generatedAt`

### `event_property_impacts`

- Entidade: `EventPropertyImpact` (`src/entities/event-property-impact.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `generatedAt` | `generatedAt` | datetime | não |  | IDX |  |
| `jobRunId` | `jobRunId` | varchar(64) | sim |  | IDX |  |
| `metricVersion` | `metricVersion` | varchar(32) | não | property-impact-v0 |  |  |
| `modelVersion` | `modelVersion` | varchar(32) | não | stub-contract-v0 |  |  |
| `distanceKm` | `distanceKm` | decimal(8,3) | sim |  |  |  |
| `travelTimeMinutes` | `travelTimeMinutes` | int | sim |  |  |  |
| `propertyCaptureScore` | `propertyCaptureScore` | decimal(5,2) | sim |  |  |  |
| `basePriceCents` | `basePriceCents` | int | sim |  |  |  |
| `currentPriceCents` | `currentPriceCents` | int | sim |  |  |  |
| `recommendedPriceCents` | `recommendedPriceCents` | int | sim |  |  |  |
| `minAbsorbablePriceCents` | `minAbsorbablePriceCents` | int | sim |  |  |  |
| `maxAbsorbablePriceCents` | `maxAbsorbablePriceCents` | int | sim |  |  |  |
| `recommendedMultiplier` | `recommendedMultiplier` | decimal(6,2) | sim |  |  |  |
| `maxPlausibleMultiplier` | `maxPlausibleMultiplier` | decimal(6,2) | sim |  |  |  |
| `bookingProbability` | `bookingProbability` | decimal(5,4) | sim |  |  |  |
| `expectedRevenueCents` | `expectedRevenueCents` | int | sim |  |  |  |
| `expectedIncrementalRevenueCents` | `expectedIncrementalRevenueCents` | int | sim |  |  |  |
| `confidence` | `confidence` | varchar(16) | não | low | IDX |  |
| `mainDrivers` | `mainDrivers` | text | sim |  |  |  |
| `priceAbsorptionScenarios` | `priceAbsorptionScenarios` | text | sim |  |  |  |
| `recommendedAction` | `recommendedAction` | varchar(16) | não | watch | IDX |  |
| `riskFlags` | `riskFlags` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `event_id` | `event` | varchar(36) | não |  | IDX, FK |  |
| `event_intelligence_snapshot_id` | `intelligenceSnapshot` | varchar(36) | sim |  | FK |  |
| `property_address_id` | `property` | varchar(36) | não |  | IDX, FK |  |
| `list_id` | `list` | varchar(36) | sim |  | FK |  |
| `host_user_id` | `hostUser` | varchar(36) | não |  | IDX, FK |  |
| `analise_preco_id` | `analisePreco` | varchar(36) | sim |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `event` | `events` | event_id | CASCADE | NO ACTION |
| many-to-one | `intelligenceSnapshot` | `event_intelligence_snapshots` | event_intelligence_snapshot_id | SET NULL | NO ACTION |
| many-to-one | `property` | `addresses` | property_address_id | CASCADE | NO ACTION |
| many-to-one | `list` | `list` | list_id | SET NULL | NO ACTION |
| many-to-one | `hostUser` | `user` | host_user_id | CASCADE | NO ACTION |
| many-to-one | `analisePreco` | `analise_preco` | analise_preco_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_16ade70984987cf7434a7a99d1`: `host_user_id`, `generatedAt`
- `IDX_270c8bd216363d2b7c40397445`: `event_id`, `property_address_id`, `generatedAt`
- `IDX_364ce9654ae88bbe6b5fc78c6c`: `confidence`, `generatedAt`
- `IDX_c13e6ecf698dc5a68c5a295640`: `jobRunId`, `event_id`, `property_address_id`, `analise_preco_id`
- `IDX_ec8dbbd10a22f83536397dd4d7`: `recommendedAction`, `generatedAt`

### `event_proximity_features`

- Entidade: `EventProximityFeature` (`src/entities/event-proximity-feature.entity.ts`)
- Domínio: Precificação e análises
- Descrição: Snapshot diário das features de proximidade a eventos para um imóvel. Hoje, quando o cron de análise roda, ele calcula travel time, distância, relevância e USA na hora — depois descarta. Resultado: não temos série temporal de "como o pipeline de eventos evoluiu para um imóvel". Esta tabela persiste, todos os dias, **as features agregadas** que o motor usaria. Vira insumo direto do XGBoost (lag features, agregados temporais) e do LSTM no Tier 4 do moat. Volume: ~N imóveis × 1 dia. Para 5k imóveis em SP = 5k linhas/dia, 1.8M linhas/ano. Tamanho administrável.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `snapshotDate` | `snapshotDate` | date | não |  | UNIQUE (composto), IDX | Data de cálculo (YYYY-MM-DD UTC). |
| `eventsNext7d` | `eventsNext7d` | int | não | 0 |  | ============ Counts brutos ============ Eventos dentro do raio do imóvel (default 5 km), em janela 7 dias à frente. |
| `eventsNext14d` | `eventsNext14d` | int | não | 0 |  | Eventos em janela 14 dias. |
| `eventsNext30d` | `eventsNext30d` | int | não | 0 |  | Eventos em janela 30 dias. |
| `megaEventsNext30d` | `megaEventsNext30d` | int | não | 0 |  | Mega-eventos (relevância >= 80) nos próximos 30 dias. |
| `closestEventDistanceKm` | `closestEventDistanceKm` | decimal(8,3) | sim |  |  | ============ Métricas agregadas ============ Distância (km) ao evento mais próximo nos próximos 14 dias. NULL se nenhum. |
| `closestEventTravelMin` | `closestEventTravelMin` | decimal(8,2) | sim |  |  | Travel time (min) ao evento mais próximo nos próximos 14 dias. |
| `avgRelevanceScore` | `avgRelevanceScore` | decimal(5,2) | sim |  |  | Score médio de relevância dos eventos no raio (0-100). |
| `maxRelevanceScore` | `maxRelevanceScore` | int | sim |  |  | Score máximo de relevância dos eventos no raio. |
| `predominantCategory` | `predominantCategory` | varchar(32) | sim |  |  | Categoria predominante (show, esporte, conferência, etc). |
| `competitiveSupplyCount` | `competitiveSupplyCount` | int | sim |  |  | ============ Features de oferta ============ # de imóveis comparáveis (mesma faixa de bedrooms/bairro) cadastrados em SP — proxy de "concorrência local". Snapshot do dia. |
| `medianCompPriceCents` | `medianCompPriceCents` | int | sim |  |  | Preço mediano dos comparáveis no raio (centavos). |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `list_id` | `list` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `address_id` | `address` | varchar(36) | sim |  | FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `list` | `list` | list_id | CASCADE | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_ec0824770c9e2c1bd5498c155e`: `snapshotDate`
- `IDX_f0c57d6f17d71db49de192d720` (UNIQUE): `list_id`, `snapshotDate`

### `event_reference`

- Entidade: `EventReference` (`src/entities/event-reference.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Lista de referência ("verdade de campo") dos eventos de SP: o que deveria estar no radar. Alimentada por CSV do admin e pela curadoria por agentes (ADR 0026). Só `aprovado` entra nas métricas de recall; `conflito` e `candidato` esperam revisão humana. `fingerprint` (nome normalizado + dia + venue) impede duplicar a mesma referência.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(255) | não |  |  |  |
| `normalizedName` | `normalizedName` | varchar(255) | não |  |  |  |
| `venueKey` | `venueKey` | varchar(64) | sim |  | IDX | Chave do venue na configuração de curadoria (ex.: `allianz-parque`); null para venue fora da lista. |
| `venueName` | `venueName` | varchar(160) | não |  |  |  |
| `normalizedVenue` | `normalizedVenue` | varchar(255) | não |  |  |  |
| `startsAt` | `startsAt` | datetime | não |  |  |  |
| `dateKey` | `dateKey` | varchar(10) | não |  | IDX | Dia do evento no calendário de São Paulo (`YYYY-MM-DD`). |
| `city` | `city` | varchar(80) | não | São Paulo |  |  |
| `category` | `category` | varchar(64) | sim |  |  |  |
| `size` | `size` | varchar(16) | não | medio |  |  |
| `status` | `status` | varchar(16) | não | candidato | IDX |  |
| `origin` | `origin` | varchar(16) | não | curadoria |  |  |
| `fingerprint` | `fingerprint` | varchar(64) | não |  | UNIQUE |  |
| `evidenceUrls` | `evidenceUrls` | text | sim |  |  | URLs das evidências (as mesmas dos votos), para auditoria rápida na lista. |
| `votesSupport` | `votesSupport` | int | não | 0 |  |  |
| `votesAgainst` | `votesAgainst` | int | não | 0 |  |  |
| `approvedBy` | `approvedBy` | varchar(64) | sim |  |  | `auto-consenso` (agentes) ou o id do usuário admin que decidiu. |
| `approvedAt` | `approvedAt` | datetime | sim |  |  |  |
| `decisionNote` | `decisionNote` | varchar(500) | sim |  |  |  |
| `conflictReason` | `conflictReason` | varchar(255) | sim |  |  |  |
| `matchedEventId` | `matchedEventId` | varchar(36) | sim |  |  | Casamento com `events` (job diário). |
| `matchScore` | `matchScore` | decimal(5,4) | sim |  |  |  |
| `matchedAt` | `matchedAt` | datetime | sim |  |  |  |
| `lastMatchCheckAt` | `lastMatchCheckAt` | datetime | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_event_reference_date`: `dateKey`
- `IDX_event_reference_status`: `status`
- `IDX_event_reference_venue_date`: `venueKey`, `dateKey`
- `UQ_event_reference_fingerprint` (UNIQUE): `fingerprint`

### `event_reference_fetch_cache`

- Entidade: `EventReferenceFetchCache` (`src/entities/event-reference-fetch-cache.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Cache por URL/consulta e dia da curadoria (teto de custo, ADR 0026): guarda o resultado já EXTRAÍDO (lista de candidatos em JSON), não o conteúdo da página. Entradas com mais de poucos dias são removidas a cada execução.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `cacheKey` | `cacheKey` | varchar(64) | não |  | UNIQUE | sha1(provedor \| url-ou-consulta \| dia). |
| `day` | `day` | varchar(10) | não |  | IDX |  |
| `provider` | `provider` | varchar(16) | não |  |  |  |
| `payload` | `payload` | text | não |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_event_reference_fetch_cache_day`: `day`
- `UQ_event_reference_fetch_cache_key` (UNIQUE): `cacheKey`

### `event_reference_votes`

- Entidade: `EventReferenceVote` (`src/entities/event-reference-vote.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Voto de um validador sobre uma referência. `validatorKey` é a chave de independência (`web:dominio`, `db:fonte` ou `judge:modelo`): dois votos com a mesma chave valem como um só. O trecho (`snippet`) e a URL ficam gravados para auditoria; nada de dado pessoal.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `referenceId` | `referenceId` | varchar(36) | não |  | UNIQUE (composto), IDX, FK |  |
| `validatorKey` | `validatorKey` | varchar(160) | não |  | UNIQUE (composto) |  |
| `validatorKind` | `validatorKind` | varchar(16) | não |  |  |  |
| `verdict` | `verdict` | varchar(16) | não |  |  |  |
| `sourceUrl` | `sourceUrl` | text | sim |  |  |  |
| `extractor` | `extractor` | varchar(16) | não | none |  |  |
| `observedName` | `observedName` | varchar(255) | sim |  |  |  |
| `observedDate` | `observedDate` | varchar(10) | sim |  |  |  |
| `observedVenue` | `observedVenue` | varchar(160) | sim |  |  |  |
| `snippet` | `snippet` | varchar(500) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `reference` | `event_reference` | referenceId | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_event_reference_votes_ref`: `referenceId`
- `UQ_event_reference_votes_ref_validator` (UNIQUE): `referenceId`, `validatorKey`

### `event_sources`

- Entidade: `EventSource` (`src/entities/event-source.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `eventId` | `eventId` | varchar(36) | não |  | IDX, FK |  |
| `source` | `source` | varchar(64) | não |  | UNIQUE (composto), IDX |  |
| `sourceId` | `sourceId` | varchar(128) | sim |  | UNIQUE (composto), IDX |  |
| `rawTitle` | `rawTitle` | varchar(500) | sim |  |  |  |
| `rawVenue` | `rawVenue` | varchar(255) | sim |  |  |  |
| `rawAddress` | `rawAddress` | text | sim |  |  |  |
| `rawStartDate` | `rawStartDate` | datetime | sim |  |  |  |
| `rawEndDate` | `rawEndDate` | datetime | sim |  |  |  |
| `url` | `url` | text | sim |  |  |  |
| `canonicalUrl` | `canonicalUrl` | varchar(512) | sim |  | IDX |  |
| `crawledUrl` | `crawledUrl` | text | sim |  |  |  |
| `rawPayload` | `rawPayload` | text | sim |  |  |  |
| `confidenceScore` | `confidenceScore` | decimal(5,4) | sim |  |  |  |
| `matchReason` | `matchReason` | varchar(255) | sim |  |  |  |
| `firstSeenAt` | `firstSeenAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `lastSeenAt` | `lastSeenAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `seenCount` | `seenCount` | int | não | 1 |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `event` | `events` | eventId | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_00bb5049231230fba7401631ff`: `canonicalUrl`
- `IDX_2657bb3979195744795926e164`: `lastSeenAt`
- `IDX_87cc6c956d2c8f49979f6ce5bd` (UNIQUE): `source`, `sourceId`
- `IDX_98c95b982ce2fae41321fb7fe9`: `sourceId`
- `IDX_9fcead4b70498e3f9defc5e868`: `eventId`
- `IDX_fa7146ac4a09942f78907cf6d7`: `source`

### `events`

- Entidade: `Event` (`src/entities/events.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto | ===================================== 🆔 IDENTIFICAÇÃO ===================================== |
| `nome` | `nome` | varchar(255) | não |  | IDX | ===================================== 📍 DADOS DO EVENTO ===================================== |
| `descricao` | `descricao` | text | sim |  |  |  |
| `dataInicio` | `dataInicio` | datetime | não |  | IDX | ===================================== 📅 DATAS E HORÁRIOS ===================================== |
| `dataFim` | `dataFim` | datetime | não |  | IDX |  |
| `enderecoCompleto` | `enderecoCompleto` | text | não |  |  | ===================================== 📍 LOCALIZAÇÃO ===================================== |
| `cidade` | `cidade` | varchar(255) | não |  | IDX |  |
| `estado` | `estado` | varchar(2) | não |  | IDX |  |
| `latitude` | `latitude` | decimal(10,8) | sim |  | IDX | ===================================== 🌍 COORDENADAS GEOGRÁFICAS ===================================== |
| `longitude` | `longitude` | decimal(11,8) | sim |  | IDX |  |
| `linkSiteOficial` | `linkSiteOficial` | text | sim |  |  | ===================================== 🔗 LINKS E MÍDIA ===================================== |
| `imagem_url` | `imagem_url` | text | sim |  |  |  |
| `categoria` | `categoria` | varchar(100) | sim |  | IDX | ===================================== 📂 CATEGORIZAÇÃO ===================================== |
| `relevancia` | `relevancia` | int | sim |  |  | ===================================== ⚙️ INTELIGÊNCIA ARTIFICIAL (ENRIQUECIMENTO) ===================================== |
| `raioImpactoKm` | `raioImpactoKm` | decimal(5,2) | sim |  |  |  |
| `capacidadeEstimada` | `capacidadeEstimada` | int | sim |  |  |  |
| `source` | `source` | varchar(64) | sim |  | IDX | ===================================== 🔀 PROCEDÊNCIA / DEDUP (F6.2 Plus — Camada 1/2/3) ===================================== Origem do evento (qual coletor/fonte trouxe). Usado para auditoria e para ponderar confiabilidade no motor de pricing. Convenções: - 'api-football' (Camada 1 — jogos) - 'sympla-api', 'eventbrite-api', 'sp-aberta-api' (Camada 1) - 'firecrawl-<site>' (Camada 2 — ex: 'firecrawl-anhembi') - 'admin-manual' (Camada 3 — curadoria humana) - 'admin-csv-import' (Camada 3 — import semestral) - 'scraper-<spider>' (legado: 'scraper-sympla', 'scraper-eventim', etc.) |
| `sourceId` | `sourceId` | varchar(128) | sim |  |  | ID do evento na fonte externa (fixture_id, eventbrite_id, etc.). |
| `dedupHash` | `dedupHash` | varchar(64) | sim |  | UNIQUE | Hash SHA-256 para dedup. Calculado em ingest: sha256(lower(nome) + '\|' + toSaoPauloDateKey(dataInicio) // dia de calendário em America/Sao_Paulo + '\|' + round(lat,3) + ',' + round(lng,3)) Permite Sympla + Eventbrite + Firecrawl reportarem o mesmo evento sem duplicar. Lat/lng arredondadas a ~100m absorvem pequenas variações entre fontes. |
| `venueCapacity` | `venueCapacity` | int | sim |  |  | Capacidade física do venue (estádio Allianz = 43kk). Diferente de capacidadeEstimada. |
| `venueType` | `venueType` | varchar(64) | sim |  | IDX | Tipo do venue. Usado pelo motor para ponderar relevância: - 'stadium' (capacidade 30k+) → boost extra - 'convention_center' → boost médio + público B2B - 'theater' → boost localizado - 'bar', 'church', 'outdoor', 'other' |
| `expectedAttendance` | `expectedAttendance` | int | sim |  |  |  |
| `historicalAttendance` | `historicalAttendance` | int | sim |  |  |  |
| `crawledUrl` | `crawledUrl` | text | sim |  |  |  |
| `canonicalName` | `canonicalName` | varchar(255) | sim |  |  |  |
| `normalizedName` | `normalizedName` | varchar(255) | sim |  |  |  |
| `normalizedVenue` | `normalizedVenue` | varchar(255) | sim |  |  |  |
| `canonicalVenueId` | `canonicalVenueId` | varchar(36) | sim |  |  |  |
| `duplicateOfEventId` | `duplicateOfEventId` | varchar(36) | sim |  |  |  |
| `dedupStatus` | `dedupStatus` | varchar(16) | não | canonical |  |  |
| `identityConfidence` | `identityConfidence` | decimal(5,4) | sim |  |  |  |
| `sourceCount` | `sourceCount` | int | não | 0 |  |  |
| `lastSeenAt` | `lastSeenAt` | datetime | sim |  |  |  |
| `pendingGeocode` | `pendingGeocode` | tinyint | não | false | IDX | Marca eventos que entraram sem lat/lng (geocoding lazy). Cron periódico `EventsGeocoderService` pega rows com pendingGeocode=true e tenta geocodificar via MapsService. Quando bem-sucedido, seta pendingGeocode=false e ativo=true (pronto pro motor usar). Mantém ativo=false enquanto pendente — motor de pricing ignora. |
| `outOfScope` | `outOfScope` | tinyint | não | false | IDX | Marca eventos fora da área de cobertura (CoverageService). Eventos `outOfScope=true` são preservados no DB (auditoria + reativação futura quando expandirmos cobertura), mas NÃO entram no motor de pricing nem são enriquecidos pela IA (economiza Gemini). Cobertura = união de: - Raio (default 80km) ao redor de cada Address ativo - Regiões em `coverage_regions` com status='active' OU 'bootstrap' |
| `enrichmentAttempts` | `enrichmentAttempts` | int | não | 0 |  | Contador de tentativas de enriquecimento via Gemini. Cron `EventsEnrichmentService` incrementa a cada try (sucesso ou falha) e re-tenta após 24h se attempts < 3. Isso evita o "limbo" do relevancia=0 que travava re-tentativas perpétuas. |
| `enrichmentLastAttemptAt` | `enrichmentLastAttemptAt` | datetime | sim |  | IDX | Timestamp da última tentativa de enriquecimento (sucesso ou falha). |
| `enrichmentLastError` | `enrichmentLastError` | varchar(500) | sim |  |  | Mensagem do último erro de enriquecimento (debug). |
| `ativo` | `ativo` | tinyint | não | true |  | ===================================== ⚙️ CONTROLE DO SISTEMA ===================================== |
| `dataCrawl` | `dataCrawl` | timestamp | sim |  | IDX |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_04c6ba002d34db794ef453aadd`: `estado`
- `IDX_09d898cc65715a8b22d7097cf1`: `dataFim`
- `IDX_144c41631f2a25ccd964f2d628`: `pendingGeocode`
- `IDX_15acf739592c0f48f7056735aa`: `dataInicio`, `dataFim`
- `IDX_1d223cd230667e7d2614e26e4c`: `venueType`
- `IDX_204faf0c2a181c459e7ce9f4c5`: `categoria`
- `IDX_2842db70f335693a76e656ae0d`: `longitude`
- `IDX_3a56c148d67440d4a749a384e5`: `cidade`, `estado`
- `IDX_58095308749008e0a54eabf0ff`: `latitude`, `longitude`
- `IDX_67108534254a58377f0b6b8fe8`: `nome`
- `IDX_abf1d6218c3e7ffe52e54ca211`: `enrichmentLastAttemptAt`
- `IDX_b2b78677ca545a1f9906bb7dc8`: `outOfScope`
- `IDX_cb1b45b0a16c1b5c5a685aec5b`: `source`
- `IDX_d10a5393425b5c2dd1c5e95be5` (UNIQUE): `dedupHash`
- `IDX_da09dd22804c5ab5d5c193df44`: `cidade`
- `IDX_e50b15278a3b66d693d8dad0f6`: `dataInicio`
- `IDX_events_cidade_estado_outOfScope`: `cidade`, `estado`, `outOfScope`
- `IDX_events_dataInicio_outOfScope`: `dataInicio`, `outOfScope`
- `IDX_events_geo_dataInicio`: `latitude`, `longitude`, `dataInicio`
- `IDX_f002d2d980327cc1c4c4e368f6`: `latitude`
- `IDX_f0cd9c1f64dd1484474fd9ed61`: `dataCrawl`

### `external_listing`

- Entidade: `ExternalListing` (`src/entities/external-listing.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Comp externo de treino (bootstrap do KNN) — anúncios reais de plataformas públicas (hoje Inside Airbnb, CC BY 4.0). Não são imóveis dos nossos hosts; servem para dar densidade de vizinhos ao classificador enquanto a base própria (Address/List) é pequena. Multi-cidade: `city` separa os mercados. `availability365` é um proxy (ruidoso) de ocupação; `priceCents` + amenidades derivam a `category` (label do KNN) via deriveCategory.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `externalId` | `externalId` | varchar(32) | não |  | UNIQUE (composto) | ID do anúncio na fonte (para dedup/upsert em reimportações). |
| `source` | `source` | varchar(32) | não | inside-airbnb | UNIQUE (composto), IDX | 'inside-airbnb' etc. |
| `city` | `city` | varchar(48) | não |  | IDX | Cidade/mercado (ex.: 'sao-paulo', 'rio-de-janeiro'). |
| `snapshotDate` | `snapshotDate` | date | sim |  |  |  |
| `latitude` | `latitude` | float | não |  | IDX |  |
| `longitude` | `longitude` | float | não |  | IDX |  |
| `priceCents` | `priceCents` | int | sim |  |  | Diária em centavos (parseada do preço da fonte). |
| `roomType` | `roomType` | varchar(48) | sim |  |  |  |
| `bedrooms` | `bedrooms` | int | sim |  |  |  |
| `bathrooms` | `bathrooms` | float | sim |  |  |  |
| `accommodates` | `accommodates` | int | sim |  |  |  |
| `minNights` | `minNights` | int | sim |  |  |  |
| `availability365` | `availability365` | int | sim |  |  | Dias disponíveis no ano — proxy (ruidoso) de ocupação. |
| `numReviews` | `numReviews` | int | sim |  |  |  |
| `reviewScore` | `reviewScore` | float | sim |  |  |  |
| `amenitiesCount` | `amenitiesCount` | int | sim |  |  |  |
| `category` | `category` | varchar(16) | sim |  |  | Categoria derivada (Economico/Standard/Premium) — label do KNN. |
| `neighborhood` | `neighborhood` | varchar(96) | sim |  |  | ===== Camada de fontes de mercado (ADR 0028) — todas opcionais ===== Bairro conforme a fonte (para métricas e saúde por bairro). |
| `listingType` | `listingType` | varchar(24) | sim |  |  | Tipo de anúncio normalizado: entire_home \| private_room \| shared_room \| hotel_room \| other. |
| `occupancyRate` | `occupancyRate` | float | sim |  |  | Ocupação observada no período (0 a 1), quando a fonte informa; null = só o proxy de availability365. |
| `airbnbListingId` | `airbnbListingId` | varchar(32) | sim |  |  | Id do anúncio no Airbnb, quando a fonte informa — chave de deduplicação entre fontes. |
| `collectedAt` | `collectedAt` | date | sim |  | IDX | Data em que a fonte coletou o dado (YYYY-MM-DD). |
| `license` | `license` | varchar(32) | sim |  |  | Licença do dado: cc_by_4 \| licensed_display_aggregate \| licensed_internal_only \| unknown. Define se pode ser exibido ao cliente (agregado) ou só usado internamente. |
| `ingestBatchId` | `ingestBatchId` | varchar(36) | sim |  |  | Lote de importação que gravou/atualizou a linha (auditoria). |

Índices e unicidades:

- `IDX_external_listing_city_geo`: `city`, `latitude`, `longitude`
- `IDX_external_listing_source_collected`: `source`, `collectedAt`
- `UQ_external_listing_source_ext` (UNIQUE): `source`, `externalId`

### `list`

- Entidade: `List` (`src/entities/list.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `titulo` | `titulo` | varchar(255) | não |  |  |  |
| `id_do_anuncio` | `id_do_anuncio` | varchar(255) | não |  |  |  |
| `internalNickname` | `internalNickname` | varchar(80) | sim |  |  |  |
| `internalCode` | `internalCode` | varchar(32) | sim |  |  |  |
| `picture_url` | `pictureUrl` | varchar(255) | sim |  |  |  |
| `ativo` | `ativo` | tinyint | não | true |  |  |
| `priceText` | `priceText` | varchar(255) | sim |  |  | ===== NOVOS CAMPOS DE PREÇO ===== |
| `raw` | `raw` | float | sim |  |  |  |
| `currency` | `currency` | varchar(255) | sim |  |  |  |
| `checkIn` | `checkIn` | date | sim |  |  |  |
| `checkOut` | `checkOut` | date | sim |  |  |  |
| `status` | `status` | varchar(255) | sim |  |  |  |
| `dailyPrice` | `dailyPrice` | float | sim |  |  |  |
| `manualDailyPrice` | `manualDailyPrice` | float | sim |  |  |  |
| `averageMonthlyRevenue` | `averageMonthlyRevenue` | float | sim |  |  |  |
| `pricingInputSource` | `pricingInputSource` | varchar(255) | sim |  |  |  |
| `pricingInputsUpdatedAt` | `pricingInputsUpdatedAt` | timestamp | sim |  |  |  |
| `minDailyPrice` | `minDailyPrice` | float | sim |  |  | ===== PLANO B DO SCRAPING (ADR 0010): dados informados pelo anfitrião ===== |
| `weekendDailyPrice` | `weekendDailyPrice` | float | sim |  |  |  |
| `hostInputUpdatedAt` | `hostInputUpdatedAt` | timestamp | sim |  |  |  |
| `essentialsSource` | `essentialsSource` | varchar(16) | sim |  |  |  |
| `essentialsUpdatedAt` | `essentialsUpdatedAt` | timestamp | sim |  |  |  |
| `hospedes` | `hospedes` | int | sim |  |  | ===== CAMPOS ADICIONAIS DO RETORNO DA API ===== |
| `quartos` | `quartos` | int | sim |  |  |  |
| `camas` | `camas` | int | sim |  |  |  |
| `banheiros` | `banheiros` | int | sim |  |  |  |
| `rating` | `rating` | float | sim |  |  | ===== CAMPOS DE ENRIQUECIMENTO (SCRAPING DIRETO) ===== |
| `propertyType` | `propertyType` | varchar(255) | sim |  |  |  |
| `amenitiesCount` | `amenitiesCount` | int | sim |  |  |  |
| `category` | `category` | varchar(16) | sim |  |  |  |
| `neighborhood` | `neighborhood` | varchar(255) | sim |  |  |  |
| `reviewCount` | `reviewCount` | int | sim |  |  |  |
| `lastScrapedAt` | `lastScrapedAt` | timestamp | sim |  |  |  |
| `user_id` | `user` | varchar(36) | sim |  | FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

### `market_ingest_log`

- Entidade: `MarketIngestLog` (`src/entities/market-ingest-log.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Registro de cada importação de dataset de mercado (licenciado ou Inside Airbnb): quem, quando, de qual arquivo, com qual licença e o resultado. Sustenta a tela de saúde das fontes e a trilha de auditoria de licença (ADR 0028). Não guarda o conteúdo do arquivo.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `source` | `source` | varchar(32) | não |  | IDX | Valor de `external_listing.source` gravado (ex.: licensed:airroi, inside-airbnb). |
| `city` | `city` | varchar(48) | não |  |  | Mercado/cidade do lote (slug). |
| `license` | `license` | varchar(32) | não |  |  | Licença atribuída ao lote. |
| `collectedAt` | `collectedAt` | date | sim |  |  | Data de coleta declarada do dataset (YYYY-MM-DD). |
| `fileName` | `fileName` | varchar(255) | sim |  |  | Nome do arquivo enviado (só o nome, sem caminho). |
| `rowsParsed` | `rowsParsed` | int | não | 0 |  |  |
| `rowsImported` | `rowsImported` | int | não | 0 |  |  |
| `rowsSkipped` | `rowsSkipped` | int | não | 0 |  |  |
| `observationsImported` | `observationsImported` | int | não | 0 |  |  |
| `importedByUserId` | `importedByUserId` | varchar(36) | sim |  |  | Usuário admin que importou (null para importação por script). |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |

Índices e unicidades:

- `IDX_market_ingest_source_created`: `source`, `createdAt`

### `market_listing_observation`

- Entidade: `MarketListingObservation` (`src/entities/market-listing-observation.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação
- Descrição: Histórico de preço/ocupação de um anúncio externo (`external_listing`) — uma linha por anúncio e data de observação. Alimenta sazonalidade, efeito de eventos e a tendência de 30 dias do mercado por bairro (ADR 0028). Datasets sem série temporal não geram linhas aqui.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `externalListingId` | `externalListingId` | varchar(36) | não |  | UNIQUE (composto) | `external_listing.id` (sem FK: a limpeza de anúncios apaga as observações pelo job, não em cascata). |
| `observedOn` | `observedOn` | date | não |  | UNIQUE (composto), IDX | Data da observação (YYYY-MM-DD). |
| `priceCents` | `priceCents` | int | sim |  |  | Diária em centavos. |
| `occupancyRate` | `occupancyRate` | float | sim |  |  | Ocupação no dia/período (0 a 1). |

Índices e unicidades:

- `IDX_market_obs_date`: `observedOn`
- `UQ_market_obs_listing_date` (UNIQUE): `externalListingId`, `observedOn`

### `notifications`

- Entidade: `Notification` (`src/entities/notification.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `title` | `title` | varchar(255) | não |  |  |  |
| `description` | `description` | text | sim |  |  |  |
| `createdAt` | `createdAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |
| `title_button` | `titleButton` | varchar(255) | sim |  |  |  |
| `redirect_to` | `redirectTo` | varchar(255) | sim |  |  |  |
| `sent` | `sent` | tinyint | não | false |  |  |
| `opened` | `opened` | tinyint | não | false |  |  |
| `send_email` | `sendEmail` | tinyint | não | false |  |  |
| `user_id` | `user` | varchar(36) | sim |  | FK | Relacionamento: cada notificação pertence a um usuário |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

### `occupancy_history`

- Entidade: `OccupancyHistory` (`src/entities/occupancy-history.entity.ts`)
- Domínio: Precificação e análises
- Descrição: Histórico de ocupação por imóvel × data. Hoje o motor passa `ocupacaoReferencia: 0` HARDCODED em `propriedade.service.ts:1402`. Sem ocupação real: - O cálculo de uplift é cego (não dá para dizer "+30% receita real") - O ML não pode aprender padrões de demanda (sazonalidade, eventos × ocupação, dia da semana × ocupação) - F7.1 (3 cases auditados) fica impossível Esta tabela resolve o gap. Cada linha representa "imóvel X no dia Y tinha status Z". Status pode vir de 4 origens: - 'manual': anfitrião marca via UI (até integração Stays fechar) - 'stays_sync': importado via Stays Reservations API (F6.4 + Tier 4) - 'airbnb_calendar': scraping do calendário público do Airbnb (cinza juridicamente — usar com cuidado) - 'inferred': estimativa via histórico (ex.: nights booked / disponíveis) Retenção: indefinida — é o ground truth da promessa "+30% receita".

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `date` | `date` | date | não |  | UNIQUE (composto), IDX | Data do calendário (YYYY-MM-DD UTC). 1 linha = 1 dia × 1 imóvel. |
| `status` | `status` | varchar(16) | não | unknown |  | Status no calendário do anfitrião: - 'booked': reservado (gerou receita) - 'available': disponível mas sem reserva - 'blocked': bloqueado pelo anfitrião (manutenção, uso pessoal) - 'unknown': sem informação ainda |
| `revenueCents` | `revenueCents` | int | sim |  |  | Receita real daquela noite, em centavos. NULL quando não-bookado ou desconhecido. |
| `listedPriceCents` | `listedPriceCents` | int | sim |  |  | Preço listado naquele dia (snapshot ligado ao PriceSnapshot). Centavos. |
| `currency` | `currency` | varchar(3) | não | BRL |  |  |
| `origin` | `origin` | varchar(32) | não |  | IDX | Origem do dado — auditoria + filtro em treino ML. |
| `externalReservationId` | `externalReservationId` | varchar(128) | sim |  |  | Para origin='stays_sync': ID da reserva externa (cross-ref). Útil para reconciliar updates posteriores (cancelamento, alteração). |
| `nightsBooked` | `nightsBooked` | int | sim |  |  | Quantidade de noites da reserva (1 quando coincide com a data). |
| `trainingReady` | `trainingReady` | tinyint | não | false |  | Marca se este registro é candidato a entrar em treino ML. Critérios: status='booked' OU 'available' (sabemos que não vendeu). 'unknown' e 'blocked' ficam fora. |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `list_id` | `list` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `address_id` | `address` | varchar(36) | sim |  | FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `list` | `list` | list_id | CASCADE | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_4e288944106ba35a277a037017`: `user_id`, `date`
- `IDX_bfb6513d4f14687f65e4de6438`: `origin`, `date`
- `IDX_eb85ee18a0b90f6c7a7bce3dbf` (UNIQUE): `list_id`, `date`

### `owner_report_links`

- Entidade: `OwnerReportLink` (`src/entities/owner-report-link.entity.ts`)
- Domínio: Proprietários e relatório mensal
- Descrição: Link público, somente leitura, de um relatório. O token em si NÃO é guardado: só o SHA-256 da parte aleatória (`tokenHash`). Expira (`expiresAt`) e o anfitrião pode revogar (`revokedAt`). Linhas vencidas/revogadas são apagadas depois de 30 dias (ADR 0027).

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `report_id` | `reportId` | varchar(36) | não |  | IDX, FK |  |
| `token_hash` | `tokenHash` | varchar(64) | não |  | UNIQUE |  |
| `origin` | `origin` | varchar(8) | não | host |  |  |
| `expires_at` | `expiresAt` | datetime | não |  | IDX |  |
| `revoked_at` | `revokedAt` | datetime | sim |  |  |  |
| `view_count` | `viewCount` | int | não | 0 |  |  |
| `first_viewed_at` | `firstViewedAt` | datetime | sim |  |  |  |
| `last_viewed_at` | `lastViewedAt` | datetime | sim |  |  |  |
| `created_at` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `report` | `owner_reports` | report_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_owner_report_links_expires`: `expires_at`
- `IDX_owner_report_links_report`: `report_id`
- `UQ_owner_report_links_token_hash` (UNIQUE): `token_hash`

### `owner_reports`

- Entidade: `OwnerReport` (`src/entities/owner-report.entity.ts`)
- Domínio: Proprietários e relatório mensal
- Descrição: Relatório mensal de um proprietário: snapshot do payload (sem IDs internos) + registro do envio por e-mail. `UQ_owner_reports_owner_period` é a chave de idempotência do envio: no máximo um relatório (e um e-mail) por proprietário por mês. Retenção: `OWNER_REPORT_RETENTION_MONTHS` (padrão 12) depois do fim do mês reportado; os links caem em cascata. Ver ADR 0027.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `owner_id` | `ownerId` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `period` | `period` | varchar(7) | não |  | UNIQUE (composto), IDX | `YYYY-MM` (mês de calendário de São Paulo). |
| `payload_json` | `payloadJson` | longtext | não |  |  |  |
| `payload_version` | `payloadVersion` | int | não | 1 |  |  |
| `generated_at` | `generatedAt` | datetime | não |  |  |  |
| `email_status` | `emailStatus` | varchar(16) | não | pending |  |  |
| `email_attempts` | `emailAttempts` | int | não | 0 |  |  |
| `email_sent_at` | `emailSentAt` | datetime | sim |  |  |  |
| `email_failure_reason` | `emailFailureReason` | varchar(255) | sim |  |  | Motivo curto da última falha (sem e-mail nem dado pessoal). |
| `created_at` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updated_at` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `owner` | `property_owners` | owner_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_owner_reports_period`: `period`
- `UQ_owner_reports_owner_period` (UNIQUE): `owner_id`, `period`

### `password_reset_tokens`

- Entidade: `PasswordResetToken` (`src/entities/password-reset-token.entity.ts`)
- Domínio: Usuários e autenticação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `tokenHash` | `tokenHash` | varchar(64) | não |  | UNIQUE |  |
| `expiresAt` | `expiresAt` | datetime | não |  |  |  |
| `usedAt` | `usedAt` | datetime | sim |  | IDX |  |
| `userAgent` | `userAgent` | varchar(255) | sim |  |  |  |
| `ip` | `ip` | varchar(64) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_1143abb8c3fad8b06dd857a8c9` (UNIQUE): `tokenHash`
- `IDX_345a1acfe2aa73314267cb374f`: `user_id`, `usedAt`

### `payment`

- Entidade: `Payment` (`src/entities/payment.entity.ts`)
- Domínio: Assinatura e Stripe

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `status` | `status` | varchar(20) | não | pending |  |  |
| `expireDate` | `expireDate` | timestamp | sim |  |  |  |
| `startDate` | `startDate` | timestamp | sim |  |  |  |
| `customerId` | `customerId` | varchar(255) | sim |  |  | ID do cliente no Stripe (cus_xxx) |
| `subscriptionId` | `subscriptionId` | varchar(255) | sim |  |  | ID da subscription no Stripe |
| `mode` | `mode` | varchar(50) | sim |  |  | Ex: 'subscription', 'payment' |
| `billingCycle` | `billingCycle` | varchar(32) | sim |  |  | Ciclo de cobrança do checkout que originou este Payment (F6.5). Valores possíveis: 'monthly' \| 'quarterly' \| 'semestral' \| 'annual'. Campo legado `mode` continua espelhando o intervalo do Stripe ('month', 'year'). |
| `listingsContratados` | `listingsContratados` | int | sim | 1 |  | Quantidade de imóveis contratados na assinatura (F6.5). O Stripe cobra `price × listingsContratados`. Se o usuário tentar cadastrar um (N+1)º imóvel, o Paywall oferece upsell de quantity. |
| `planName` | `planName` | varchar(64) | sim |  |  | Nome do plano persistido para referência (starter \| profissional \| escala). Útil para joins simples sem precisar pegar o Plan inteiro. |
| `trialUsedAt` | `trialUsedAt` | timestamp | sim |  |  | Stripe sends webhooks at least once and may deliver them out of order. These fields keep a small per-customer replay window and the newest event timestamp applied to this local billing projection. Momento em que o trial gratuito foi consumido por este usuário. Impede novo trial (checkout `plan: 'trial'`) após o primeiro. |
| `lastStripeEventCreated` | `lastStripeEventCreated` | bigint | sim |  |  |  |
| `recentStripeEventIds` | `recentStripeEventIds` | text | sim |  |  |  |
| `createdAt` | `createdAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |
| `user_id` | `user` | varchar(36) | sim |  | FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

### `plans`

- Entidade: `Plan` (`src/entities/plan.entity.ts`)
- Domínio: Assinatura e Stripe
- Descrição: Tabela de planos. Modelo de cobrança (F6.5, ago/2026 →): cobrança **por imóvel**, com 4 ciclos (mensal, trimestral, semestral, anual). Mensal é mais caro propositalmente para empurrar para ciclos longos. Os campos `priceMonthly/Quarterly/Semestral/Annual` são valores **por imóvel, por mês**, em string para preservar formato local (R$ 97,00 etc.). O valor total cobrado ao Stripe é price × quantity (Stripe `line_items[].quantity`). Os campos legados `price`, `priceAnnual`, `stripePriceId`, `stripePriceIdAnnual` são mantidos durante a janela de migração (grandfathering).

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(255) | não |  | UNIQUE |  |
| `title` | `title` | varchar(255) | não |  |  |  |
| `price` | `price` | varchar(255) | sim |  |  | ============= Legados (mensal/anual binário, pré-F6.5) ============= Mantidos para compatibilidade com Payments existentes; novos checkouts devem usar a matriz de 4 ciclos abaixo. |
| `priceAnnual` | `priceAnnual` | varchar(255) | sim |  |  |  |
| `originalPrice` | `originalPrice` | varchar(255) | sim |  |  |  |
| `originalPriceAnnual` | `originalPriceAnnual` | varchar(255) | sim |  |  |  |
| `stripePriceId` | `stripePriceId` | varchar(255) | sim |  |  |  |
| `stripePriceIdAnnual` | `stripePriceIdAnnual` | varchar(255) | sim |  |  |  |
| `priceMonthly` | `priceMonthly` | varchar(255) | sim |  |  | ============= Matriz F6.5 (preço por imóvel, por mês equivalente) ============= |
| `priceQuarterly` | `priceQuarterly` | varchar(255) | sim |  |  |  |
| `priceSemestral` | `priceSemestral` | varchar(255) | sim |  |  |  |
| `priceAnnualNew` | `priceAnnualNew` | varchar(255) | sim |  |  |  |
| `originalPriceMonthly` | `originalPriceMonthly` | varchar(255) | sim |  |  |  |
| `originalPriceQuarterly` | `originalPriceQuarterly` | varchar(255) | sim |  |  |  |
| `originalPriceSemestral` | `originalPriceSemestral` | varchar(255) | sim |  |  |  |
| `originalPriceAnnualNew` | `originalPriceAnnualNew` | varchar(255) | sim |  |  |  |
| `stripePriceIdMonthly` | `stripePriceIdMonthly` | varchar(255) | sim |  |  |  |
| `stripePriceIdQuarterly` | `stripePriceIdQuarterly` | varchar(255) | sim |  |  |  |
| `stripePriceIdSemestral` | `stripePriceIdSemestral` | varchar(255) | sim |  |  |  |
| `stripePriceIdAnnualNew` | `stripePriceIdAnnualNew` | varchar(255) | sim |  |  |  |
| `discountQuarterlyPercent` | `discountQuarterlyPercent` | int | sim |  |  | Desconto % aplicado a cada ciclo vs. preço base mensal (apenas display). |
| `discountSemestralPercent` | `discountSemestralPercent` | int | sim |  |  |  |
| `discountAnnualPercent` | `discountAnnualPercent` | int | sim |  |  |  |
| `discountBadge` | `discountBadge` | varchar(255) | sim |  |  | ============= Display / metadata ============= |
| `highlightBadge` | `highlightBadge` | varchar(255) | sim |  |  |  |
| `period` | `period` | varchar(255) | sim |  |  |  |
| `features` | `features` | text | não |  |  |  |
| `propertyLimit` | `propertyLimit` | int | sim |  |  |  |
| `minProperties` | `minProperties` | int | sim |  |  |  |
| `maxProperties` | `maxProperties` | int | sim |  |  |  |
| `maxCheckoutQuantity` | `maxCheckoutQuantity` | int | sim |  |  |  |
| `selfServiceEnabled` | `selfServiceEnabled` | tinyint | não | true |  |  |
| `sortOrder` | `sortOrder` | int | não | 0 |  |  |
| `isCustomPrice` | `isCustomPrice` | tinyint | não | false |  |  |
| `isActive` | `isActive` | tinyint | não | true |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_253d25dae4c94ee913bc5ec485` (UNIQUE): `name`

### `platform_costs`

- Entidade: `PlatformCost` (`src/entities/platform-cost.entity.ts`)
- Domínio: Administração e auditoria
- Descrição: Custos operacionais da plataforma Urban AI. Cada linha = uma fonte de custo (Railway, Brevo, Gemini, Stripe, Firecrawl, contractor, marketing, etc.). Permite o `/admin/finance` calcular margem real, custo por imóvel e simular cenários de pricing. Categorias sugeridas: - 'infra': Railway, Upstash, AWS S3, GCP, Sentry, UptimeRobot - 'apis': RapidAPI, Gemini, Google Maps, api-football, Firecrawl - 'comms': Brevo, WhatsApp Business - 'payments': Stripe (taxa) - 'people': contractor dev, agência marketing, suporte - 'marketing': Google Ads, Meta Ads, mídia direta, design - 'legal': advogado LGPD pontual, contadores - 'data': Airbtics, AirDNA, AirROI plano pago - 'other': eventuais, ajustes Recorrência: - 'monthly': cobrado todo mês com valor estável (Railway, Brevo) - 'usage_based': varia conforme uso (Gemini, Maps); valor é estimativa - 'one_time': pago uma vez (advogado pontual, audit) - 'percentual': % de receita (Stripe ~5%; usar `percentOfRevenue`)

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `name` | `name` | varchar(128) | não |  |  |  |
| `category` | `category` | varchar(32) | não |  | IDX |  |
| `recurrence` | `recurrence` | varchar(16) | não | monthly | IDX |  |
| `monthlyCostCents` | `monthlyCostCents` | int | não | 0 |  | Valor mensal em centavos (BRL). Para `usage_based` é estimativa atualizada manualmente pelo admin. Para `one_time`, representa o custo amortizado por mês (ex: R$ 6k de advogado / 12 meses = R$ 500/mês). |
| `percentOfRevenue` | `percentOfRevenue` | decimal(6,3) | sim |  |  | Para `recurrence='percentual'`: % de receita que vira custo. Ex: Stripe taxa = 4.99 → percentOfRevenue = 4.99 |
| `currency` | `currency` | varchar(3) | não | BRL |  |  |
| `description` | `description` | varchar(255) | sim |  |  |  |
| `scalesWithListings` | `scalesWithListings` | tinyint | não | false |  | Indica se o custo escala diretamente com o número de imóveis ativos. Útil para calcular "custo por imóvel". Ex: Brevo cresce com volume de e-mails (proporcional a usuários, e usuários ~ imóveis). |
| `notes` | `notes` | text | sim |  |  | Notas internas (contrato, fornecedor, próxima renovação) |
| `active` | `active` | tinyint | não | true | IDX |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_1a309daf57140996c183fef829`: `recurrence`
- `IDX_94767407b645c64d13a43ce7eb`: `category`, `active`

### `portfolio_action_items`

- Entidade: `PortfolioActionItem` (`src/entities/portfolio-action-item.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `property_id` | `propertyId` | varchar(36) | sim |  |  |  |
| `targetDate` | `targetDate` | date | sim |  | IDX |  |
| `action` | `action` | varchar(64) | não |  | IDX |  |
| `status` | `status` | varchar(24) | não |  | IDX |  |
| `before` | `before` | text | sim |  |  |  |
| `after` | `after` | text | sim |  |  |  |
| `metadata` | `metadata` | text | sim |  |  |  |
| `estimatedLift` | `estimatedLift` | decimal(10,2) | sim |  |  |  |
| `errorMessage` | `errorMessage` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `run_id` | `run` | varchar(36) | não |  | IDX, FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |
| `address_id` | `address` | varchar(36) | sim |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `run` | `portfolio_action_runs` | run_id | CASCADE | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_0453819149e435ceed2ab29321`: `action`, `createdAt`
- `IDX_69f37c0db47dff38dad1cac27b`: `address_id`, `targetDate`
- `IDX_84dd57143cc53c3415954aa087`: `run_id`, `status`
- `IDX_b12b04d5bbb9392808f964b2d6`: `user_id`, `createdAt`

### `portfolio_action_runs`

- Entidade: `PortfolioActionRun` (`src/entities/portfolio-action-run.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `action` | `action` | varchar(64) | não |  | IDX |  |
| `status` | `status` | varchar(24) | não | running |  |  |
| `selectedPropertyIds` | `selectedPropertyIds` | text | sim |  |  |  |
| `targetDates` | `targetDates` | text | sim |  |  |  |
| `payload` | `payload` | text | sim |  |  |  |
| `summary` | `summary` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `completedAt` | `completedAt` | timestamp | sim |  |  |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| one-to-many | `items` | `portfolio_action_items` | (lado inverso) |  |  |

Índices e unicidades:

- `IDX_74b79ef2c86bac674e7ead6eb5`: `user_id`, `createdAt`
- `IDX_d2803e371322d201a345f06657`: `action`, `createdAt`

### `portfolio_daily_price_overrides`

- Entidade: `PortfolioDailyPriceOverride` (`src/entities/portfolio-daily-price-override.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `targetDate` | `targetDate` | date | não |  | UNIQUE (composto), IDX |  |
| `price` | `price` | decimal(10,2) | não |  |  |  |
| `source` | `source` | varchar(48) | não | portfolio_manual |  |  |
| `metadata` | `metadata` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `address_id` | `address` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |
| `action_run_id` | `actionRun` | varchar(36) | sim |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `address` | `addresses` | address_id | CASCADE | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| many-to-one | `actionRun` | `portfolio_action_runs` | action_run_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_a4fd5b0ea13c0dfbcd4c39d429`: `user_id`, `targetDate`
- `IDX_b9502d9227a6a0c3cb56f4d1b4`: `action_run_id`
- `IDX_c8c99ac0697addb60ed9335bbf` (UNIQUE): `address_id`, `targetDate`

### `portfolio_property_settings`

- Entidade: `PortfolioPropertySetting` (`src/entities/portfolio-property-setting.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `strategy` | `strategy` | varchar(24) | não | balanced |  |  |
| `metadata` | `metadata` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `address_id` | `address` | varchar(36) | não |  | UNIQUE, FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `address` | `addresses` | address_id | CASCADE | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_2dd78fba1f54c092585c87441e` (UNIQUE): `address_id`
- `IDX_558e30a8cd10de2182739bb2f8`: `user_id`, `updatedAt`

### `price_snapshots`

- Entidade: `PriceSnapshot` (`src/entities/price-snapshot.entity.ts`)
- Domínio: Precificação e análises
- Descrição: Snapshot diário do preço de UM imóvel (próprio ou comp da vizinhança). Esta tabela é o **coração do dataset proprietário** da Urban AI. Contexto: até hoje só gravávamos preço quando havia análise gerada (ou seja, imóvel × evento próximo). Com `PriceSnapshot` capturamos diariamente o preço de **todos** os imóveis monitorados — próprios E comps que aparecem nas análises — virando histórico contínuo que alimenta: - Treino XGBoost com séries reais - Backtesting de qualidade (MAPE) sobre dados próprios - Detecção de tendência por bairro - Validação de "+30% receita" (Tier 4 do roadmap F6.1) Origem possível de uma linha: - 'self_cron': cron diário varre imóveis cadastrados e snapshotea - 'comp_extraction': comps coletados durante análise foram persistidos - 'manual_import': import via script (AirROI, Base dos Dados) - 'stays_sync': sincronização com Stays para imóveis conectados Retenção: indefinida (dataset cresce com o tempo, vira ativo). Quando passar de 12 meses por imóvel + 200 imóveis, atinge o gate do Tier 2.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `snapshotDate` | `snapshotDate` | date | não |  | IDX | Data do snapshot (YYYY-MM-DD UTC). 1 linha = 1 dia × 1 imóvel. |
| `externalListingId` | `externalListingId` | varchar(64) | sim |  | IDX | ID externo (Airbnb listingID, AirROI id, etc.). Usado para rastrear comps e imports. Pode coincidir com `list.id_do_anuncio` quando o imóvel próprio também tem o ID Airbnb. |
| `priceCents` | `priceCents` | int | não |  |  | Centavos. Sempre BRL salvo `currency` indicando outra. |
| `currency` | `currency` | varchar(3) | não | BRL |  |  |
| `appliedPriceCents` | `appliedPriceCents` | int | sim |  |  | Quando aplicável, preço **realmente aplicado** pelo anfitrião após uma recomendação aceita (vs `priceCents` que é o preço observado). Útil para medir MAPE real e o "uplift" praticado. |
| `origin` | `origin` | varchar(32) | não |  | IDX | Origem deste snapshot (auditoria + filtro em treino). |
| `observedCheckIn` | `observedCheckIn` | date | sim |  |  | Check-in consultado quando o snapshot vem de uma observacao real futura. |
| `observedCheckOut` | `observedCheckOut` | date | sim |  |  | Check-out consultado quando o snapshot vem de uma observacao real futura. |
| `observedNights` | `observedNights` | int | sim |  |  | Número de noites da cotação observada. |
| `observedTotalPriceCents` | `observedTotalPriceCents` | int | sim |  |  | Total da estadia observado na fonte, em centavos. |
| `observedSource` | `observedSource` | varchar(32) | sim |  |  | Fonte efetiva da observacao: browser, RapidAPI, manual etc. |
| `observedAt` | `observedAt` | datetime | sim |  |  | Momento exato da coleta, separado de createdAt para auditoria de fonte. |
| `observationMetadata` | `observationMetadata` | text | sim |  |  | Metadados pequenos e serializáveis da cotação/fonte. |
| `nearbyEventsCount` | `nearbyEventsCount` | int | sim |  |  | Snapshot de features que existiam naquele dia (lat/lng não muda mas eventos próximos sim, então persistir o nº de eventos próximos no dia vira feature temporal valiosa para o ML). |
| `bedrooms` | `bedrooms` | int | sim |  |  |  |
| `bathrooms` | `bathrooms` | int | sim |  |  |  |
| `similarityScore` | `similarityScore` | decimal(4,2) | sim |  |  | só para origin='comp_extraction' |
| `bairro` | `bairro` | varchar(64) | sim |  |  |  |
| `trainingReady` | `trainingReady` | tinyint | não | false |  | Marcador de qualidade — true quando o snapshot tem todas as features necessárias para entrar em treino. False = útil para inspeção mas não para fit do modelo. |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `list_id` | `list` | varchar(36) | sim |  | IDX, FK | Imóvel interno (List) — preenchido para snapshots de imóveis cadastrados. |
| `address_id` | `address` | varchar(36) | sim |  | IDX, FK | Endereço associado, para enriquecimento espacial sem precisar do List inteiro. |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `list` | `list` | list_id | SET NULL | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_0862ac3e6d8c08ea01bed3a36d`: `origin`, `snapshotDate`
- `IDX_4ea8b18ac5b4fa4a76aefed43e`: `address_id`, `snapshotDate`
- `IDX_c59cd909e330c7ab91407a6666`: `snapshotDate`, `externalListingId`
- `IDX_fda6ac9c169796f618e38dd723`: `list_id`, `snapshotDate`

### `price_updates`

- Entidade: `PriceUpdate` (`src/entities/price-update.entity.ts`)
- Domínio: Precificação e análises
- Descrição: Log auditável de cada push de preço feito ao canal externo (Stays/Airbnb). Fonte única para: - Provar ao anfitrião por que o preço mudou em tal data - Atender eventuais disputas com Airbnb ("você aplicou preço sem minha autorização") — comprovamos consentimento + log da chamada - Métricas de ROI por imóvel (quantas sugestões foram aplicadas vs ignoradas, quanto o preço realmente variou) - Rollback em caso de acidente (guardamos o preço anterior) Retenção LGPD: 24 meses (ver politica-privacidade-interna.md §7).

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `targetDate` | `targetDate` | date | não |  | IDX | Data do calendário a que o preço se aplica (YYYY-MM-DD em UTC). |
| `previousPriceCents` | `previousPriceCents` | int | não |  |  |  |
| `newPriceCents` | `newPriceCents` | int | não |  |  |  |
| `currency` | `currency` | varchar(3) | não | BRL |  | Moeda ISO 4217 (ex.: BRL). |
| `origin` | `origin` | varchar(32) | não |  |  | Origem da decisão: - ai_auto: modo autônomo, IA empurrou sem confirmação humana - user_accepted: usuário clicou "aplicar" na sugestão do dashboard - user_manual: usuário mudou o preço manualmente via nossa UI - rollback: reverteu um push anterior (referência em rollbackOf) |
| `status` | `status` | varchar(32) | não | pending |  | Status de execução do push no canal externo: - pending: em fila - success: Stays confirmou - rejected: Stays recusou (ex.: listing inativo, preço fora da faixa) - error: erro de rede/timeout; pode ser reprocessado |
| `errorMessage` | `errorMessage` | varchar(255) | sim |  |  |  |
| `ip` | `ip` | varchar(64) | sim |  |  | IP de quem iniciou (se user_accepted ou user_manual) — auditoria. |
| `userAgent` | `userAgent` | varchar(255) | sim |  |  |  |
| `idempotencyKey` | `idempotencyKey` | varchar(128) | não |  | UNIQUE | Idempotency key — conta + origem + requestId da decisão. Clientes legados sem requestId usam UUID interno do listing/data/valor (replay do recibo). Duas chamadas com a mesma key não resultam em 2 pushes: a segunda retorna o resultado da primeira, com conflito se mudar o corpo. Uma nova decisão, uma nova tentativa de rollback ou reaplicar após rollback usam outro requestId (contador de tentativa / geração de rollback). |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |
| `stays_listing_id` | `listing` | varchar(36) | não |  | IDX, FK |  |
| `analise_preco_id` | `analise` | varchar(36) | sim |  | IDX, FK | AnalisePreco que originou este push. Nullable porque o usuário pode chamar um push manual fora do fluxo de recomendação. |
| `rollback_of_id` | `rollbackOf` | varchar(36) | sim |  | FK | Referência ao PriceUpdate que este rollback está desfazendo. |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| many-to-one | `listing` | `stays_listings` | stays_listing_id | CASCADE | NO ACTION |
| many-to-one | `analise` | `analise_preco` | analise_preco_id | SET NULL | NO ACTION |
| many-to-one | `rollbackOf` | `price_updates` | rollback_of_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_303c1e46ed8043114133665d5f`: `user_id`, `createdAt`
- `IDX_9a8d40b975613d2268881da745` (UNIQUE): `idempotencyKey`
- `IDX_ef31c0de68527eddace1c983a7`: `analise_preco_id`
- `IDX_fb59fb5ffd6c5acd69a8dcdd9e`: `stays_listing_id`, `targetDate`

### `pricing_decision_snapshots`

- Entidade: `PricingDecisionSnapshot` (`src/entities/pricing-decision-snapshot.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `targetDate` | `targetDate` | date | sim |  | IDX |  |
| `generatedAt` | `generatedAt` | datetime | não |  |  |  |
| `jobRunId` | `jobRunId` | varchar(64) | sim |  |  |  |
| `metricVersion` | `metricVersion` | varchar(32) | não | pricing-decision-v0 |  |  |
| `modelVersion` | `modelVersion` | varchar(32) | não | stub-contract-v0 |  |  |
| `decisionType` | `decisionType` | varchar(32) | não | event_pricing |  |  |
| `basePriceCents` | `basePriceCents` | int | sim |  |  |  |
| `currentPriceCents` | `currentPriceCents` | int | sim |  |  |  |
| `recommendedPriceCents` | `recommendedPriceCents` | int | sim |  |  |  |
| `selectedPriceCents` | `selectedPriceCents` | int | sim |  |  |  |
| `appliedPriceCents` | `appliedPriceCents` | int | sim |  |  |  |
| `recommendedMultiplier` | `recommendedMultiplier` | decimal(6,2) | sim |  |  |  |
| `bookingProbability` | `bookingProbability` | decimal(5,4) | sim |  |  |  |
| `expectedRevenueCents` | `expectedRevenueCents` | int | sim |  |  |  |
| `expectedIncrementalRevenueCents` | `expectedIncrementalRevenueCents` | int | sim |  |  |  |
| `confidence` | `confidence` | varchar(16) | não | low |  |  |
| `status` | `status` | varchar(16) | não | draft | IDX |  |
| `inputSignals` | `inputSignals` | text | sim |  |  |  |
| `guardrails` | `guardrails` | text | sim |  |  |  |
| `drivers` | `drivers` | text | sim |  |  |  |
| `priceAbsorptionScenarios` | `priceAbsorptionScenarios` | text | sim |  |  |  |
| `riskFlags` | `riskFlags` | text | sim |  |  |  |
| `explanation` | `explanation` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |
| `property_address_id` | `property` | varchar(36) | sim |  | FK |  |
| `list_id` | `list` | varchar(36) | sim |  | FK |  |
| `event_id` | `event` | varchar(36) | sim |  | IDX, FK |  |
| `event_intelligence_snapshot_id` | `eventIntelligenceSnapshot` | varchar(36) | sim |  | FK |  |
| `event_property_impact_id` | `eventPropertyImpact` | varchar(36) | sim |  | FK |  |
| `analise_preco_id` | `analisePreco` | varchar(36) | sim |  | IDX, FK |  |
| `price_update_id` | `priceUpdate` | varchar(36) | sim |  | FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| many-to-one | `property` | `addresses` | property_address_id | SET NULL | NO ACTION |
| many-to-one | `list` | `list` | list_id | SET NULL | NO ACTION |
| many-to-one | `event` | `events` | event_id | SET NULL | NO ACTION |
| many-to-one | `eventIntelligenceSnapshot` | `event_intelligence_snapshots` | event_intelligence_snapshot_id | SET NULL | NO ACTION |
| many-to-one | `eventPropertyImpact` | `event_property_impacts` | event_property_impact_id | SET NULL | NO ACTION |
| many-to-one | `analisePreco` | `analise_preco` | analise_preco_id | SET NULL | NO ACTION |
| many-to-one | `priceUpdate` | `price_updates` | price_update_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_7c4998d0215846f95c9ce98e53`: `event_id`, `targetDate`
- `IDX_997d1add79f3773d3daab1b62a`: `status`, `createdAt`
- `IDX_9faf74cc6f5d9fe67c37fcdfb0`: `user_id`, `targetDate`
- `IDX_b5b16e6182e3ae696d4410e586`: `analise_preco_id`

### `pricing_input_history`

- Entidade: `PricingInputHistory` (`src/entities/pricing-input-history.entity.ts`)
- Domínio: Imóveis, anúncios e Stays

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `previousManualDailyPrice` | `previousManualDailyPrice` | float | sim |  |  |  |
| `newManualDailyPrice` | `newManualDailyPrice` | float | sim |  |  |  |
| `previousAverageMonthlyRevenue` | `previousAverageMonthlyRevenue` | float | sim |  |  |  |
| `newAverageMonthlyRevenue` | `newAverageMonthlyRevenue` | float | sim |  |  |  |
| `source` | `source` | varchar(32) | não | manual |  |  |
| `changedByUserId` | `changedByUserId` | varchar(64) | sim |  |  |  |
| `created_at` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `list_id` | `list` | varchar(36) | não |  | IDX, FK |  |
| `address_id` | `address` | varchar(36) | sim |  | IDX, FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `list` | `list` | list_id | CASCADE | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | SET NULL | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_587bdc74ab2bad96662e2025f7`: `address_id`, `created_at`
- `IDX_b98174108b432fbfef72a28d13`: `user_id`, `created_at`
- `IDX_ddcb5541323452ea10d9982774`: `list_id`, `created_at`

### `pricing_recommendation_digests`

- Entidade: `PricingRecommendationDigest` (`src/entities/pricing-recommendation-digest.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | não |  | IDX, FK |  |
| `recipient_email` | `recipientEmail` | varchar(254) | não |  |  |  |
| `recipient_name` | `recipientName` | varchar(160) | sim |  |  |  |
| `wants_email` | `wantsEmail` | tinyint | não | false |  |  |
| `wants_push` | `wantsPush` | tinyint | não | false |  |  |
| `items_json` | `itemsJson` | longtext | não |  |  |  |
| `item_count` | `itemCount` | int | não | 0 |  |  |
| `status` | `status` | varchar(24) | não | pending | IDX |  |
| `scheduled_for` | `scheduledFor` | datetime | não |  | IDX |  |
| `locked_at` | `lockedAt` | datetime | sim |  |  |  |
| `sent_at` | `sentAt` | datetime | sim |  |  |  |
| `failure_reason` | `failureReason` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_pricing_digest_created`: `createdAt`
- `IDX_pricing_digest_status_scheduled`: `status`, `scheduled_for`
- `IDX_pricing_digest_user_status`: `user_id`, `status`

### `pricing_rule_configs`

- Entidade: `PricingRuleConfig` (`src/entities/pricing-rule-config.entity.ts`)
- Domínio: Precificação e análises

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `rules` | `rules` | text | não |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |
| `address_id` | `address` | varchar(36) | não |  | UNIQUE, FK |  |
| `user_id` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `address` | `addresses` | address_id | CASCADE | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_a0c9f554f7363af08369eab78f` (UNIQUE): `address_id`
- `IDX_d4e874b54d41a8b6da97578e80`: `user_id`, `updatedAt`

### `process_status`

- Entidade: `ProcessStatus` (`src/entities/processStatus.entity.ts`)
- Domínio: Eventos, ingestão e deduplicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `status` | `status` | enum('running','completed','error') | não | completed |  |  |
| `errorMessage` | `errorMessage` | text | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

### `property_owner_properties`

- Entidade: `PropertyOwnerProperty` (`src/entities/property-owner-property.entity.ts`)
- Domínio: Proprietários e relatório mensal
- Descrição: Vínculo proprietário -> imóvel. Um imóvel tem no máximo UM proprietário (`UQ_property_owner_properties_address`); um proprietário pode ter vários imóveis.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `owner_id` | `ownerId` | varchar(36) | não |  | IDX, FK |  |
| `address_id` | `addressId` | varchar(36) | não |  | UNIQUE, FK |  |
| `created_at` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `owner` | `property_owners` | owner_id | CASCADE | NO ACTION |
| many-to-one | `address` | `addresses` | address_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_property_owner_properties_owner`: `owner_id`
- `UQ_property_owner_properties_address` (UNIQUE): `address_id`

### `property_owners`

- Entidade: `PropertyOwner` (`src/entities/property-owner.entity.ts`)
- Domínio: Proprietários e relatório mensal
- Descrição: Proprietário de imóvel(is) cadastrado pelo anfitrião (ADR 0027). NÃO é conta nem usuário: é um terceiro que só recebe o relatório mensal. O anfitrião é quem responde pelo compartilhamento (declaração de base legal registrada em `consent*`). Retenção: some junto com a conta do anfitrião (CASCADE) ou quando o anfitrião o remove.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | não |  | UNIQUE (composto), FK |  |
| `name` | `name` | varchar(160) | não |  |  |  |
| `email` | `email` | varchar(254) | não |  | UNIQUE (composto) | Sempre em minúsculas. |
| `monthly_report_enabled` | `monthlyReportEnabled` | tinyint | não | true |  | Preferência do anfitrião: enviar o relatório mensal por e-mail. |
| `consent_version` | `consentVersion` | varchar(48) | não |  |  | Versão do texto de declaração aceito pelo anfitrião (ver owner-report.constants). |
| `consent_accepted_at` | `consentAcceptedAt` | datetime | não |  |  |  |
| `consent_ip` | `consentIp` | varchar(64) | sim |  |  | IP real (`req.ip`) de quem declarou. |
| `unsubscribed_at` | `unsubscribedAt` | datetime | sim |  |  | O próprio proprietário pediu para não receber (link de descadastro). O anfitrião não desfaz. |
| `unsubscribe_ref` | `unsubscribeRef` | varchar(32) | não |  | UNIQUE | Referência opaca (não é o ID) do token de descadastro; o token só vale com a assinatura HMAC. |
| `created_at` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updated_at` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `UQ_property_owners_unsubscribe_ref` (UNIQUE): `unsubscribe_ref`
- `UQ_property_owners_user_email` (UNIQUE): `user_id`, `email`

### `push_deliveries`

- Entidade: `PushDelivery` (`src/entities/push-delivery.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `subscription_id` | `subscriptionId` | varchar(36) | não |  | IDX, FK |  |
| `user_id` | `userId` | varchar(36) | não |  | IDX, FK |  |
| `payloadJson` | `payloadJson` | text | não |  |  |  |
| `deliverAfter` | `deliverAfter` | datetime | sim |  | IDX | Push adiado pelo horário de silêncio: só é enviado (e só aparece para o service worker) depois deste instante. Nulo = fluxo normal. O envio zera a coluna de forma atômica. |
| `expiresAt` | `expiresAt` | datetime | sim |  |  | Depois disto o push adiado perde o sentido (ex.: evento já começou) e é descartado. |
| `tag` | `tag` | varchar(120) | sim |  |  | Tag do payload; push adiados com a mesma tag no mesmo dispositivo são colapsados no envio. |
| `pushedAt` | `pushedAt` | datetime | sim |  |  |  |
| `deliveredAt` | `deliveredAt` | datetime | sim |  | IDX |  |
| `failedAt` | `failedAt` | datetime | sim |  |  |  |
| `failureReason` | `failureReason` | varchar(255) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) | IDX |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `subscription` | `push_subscriptions` | subscription_id | CASCADE | NO ACTION |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_push_deliveries_deferred`: `deliverAfter`
- `IDX_push_deliveries_subscription_pending`: `subscription_id`, `deliveredAt`
- `IDX_push_deliveries_user_created`: `user_id`, `createdAt`

### `push_subscriptions`

- Entidade: `PushSubscription` (`src/entities/push-subscription.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | não |  | IDX, FK |  |
| `deviceId` | `deviceId` | varchar(64) | não |  | UNIQUE |  |
| `deviceSecretHash` | `deviceSecretHash` | varchar(64) | não |  |  |  |
| `endpointHash` | `endpointHash` | varchar(64) | não |  | UNIQUE |  |
| `endpoint` | `endpoint` | varchar(2048) | não |  |  |  |
| `p256dh` | `p256dh` | varchar(255) | não |  |  |  |
| `auth` | `auth` | varchar(255) | não |  |  |  |
| `userAgent` | `userAgent` | text | sim |  |  |  |
| `platform` | `platform` | varchar(64) | sim |  |  |  |
| `active` | `active` | tinyint | não | true | IDX |  |
| `failedAttempts` | `failedAttempts` | int | não | 0 |  |  |
| `lastPushAttemptAt` | `lastPushAttemptAt` | datetime | sim |  |  |  |
| `lastPushSuccessAt` | `lastPushSuccessAt` | datetime | sim |  |  |  |
| `lastPushFailureAt` | `lastPushFailureAt` | datetime | sim |  |  |  |
| `failureReason` | `failureReason` | varchar(255) | sim |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_push_subscriptions_device` (UNIQUE): `deviceId`
- `IDX_push_subscriptions_endpoint_hash` (UNIQUE): `endpointHash`
- `IDX_push_subscriptions_user_active`: `user_id`, `active`

### `refresh_tokens`

- Entidade: `RefreshToken` (`src/entities/refresh-token.entity.ts`)
- Domínio: Usuários e autenticação
- Descrição: Refresh token persistido para suportar rotation + revogação. Armazenamos apenas o hash (SHA-256) do token bruto — o token em si vive só no cookie httpOnly do cliente. Um leak do banco não vaza sessões ativas. Cada linha pode ser: - válida (revokedAt NULL e expiresAt > now): usável em /auth/refresh - rotacionada (revokedAt preenchido com replacedBy pointer — não modelado explicitamente ainda, mas o campo revokedAt sinaliza o evento) - expirada naturalmente (expiresAt <= now) - revogada manualmente (logout, delete user, incident)

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `tokenHash` | `tokenHash` | varchar(64) | não |  | UNIQUE | SHA-256 hex do refresh token bruto. 64 chars. |
| `expiresAt` | `expiresAt` | datetime | não |  |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `revokedAt` | `revokedAt` | datetime | sim |  | IDX |  |
| `userAgent` | `userAgent` | varchar(255) | sim |  |  | User-Agent e IP que originou o token — para auditoria. Opcional. |
| `ip` | `ip` | varchar(64) | sim |  |  |  |
| `userId` | `user` | varchar(36) | não |  | IDX, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `user` | `user` | userId | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_070d648bde98d061fd6e9d176d`: `userId`, `revokedAt`
- `IDX_c25bc63d248ca90e8dcc1d92d0` (UNIQUE): `tokenHash`

### `stays_accounts`

- Entidade: `StaysAccount` (`src/entities/stays-account.entity.ts`)
- Domínio: Imóveis, anúncios e Stays
- Descrição: Conta Stays (stays.net) conectada por um anfitrião Urban AI. Uma conta = um token de Open API (clientId + clientSecret ou access token rotacionável, dependendo do que a Stays fornecer). Persistimos criptografado em repouso via column transformer (ver note abaixo). NOTA sobre segredos: até termos HashiCorp Vault ou similar (F9.3), os secrets ficam em colunas do MySQL criptografados em repouso pelo Railway (AES-256 automático do provider). Quando o cliente pedir, **derrubamos o registro inteiro** (onDelete CASCADE) — não há "soft delete" de credencial.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `clientId` | `clientId` | varchar(128) | não |  |  | Identificador do cliente Stays (clientId ou equivalente). Não é segredo, mas também não precisa aparecer em logs. |
| `apiAccountSlug` | `apiAccountSlug` | varchar(63) | sim |  |  | Identificador da conta na Stays (subdomínio `<slug>.stays.net`), validado por `^[a-z0-9-]{1,63}$`. Nunca guardamos URL livre (SSRF). null = usa a configuração legada do ambiente (STAYS_API_BASE_URL). |
| `accessToken` | `accessToken` | varchar(2048) | não |  |  | Access token / client secret para chamar a Open API. ⚠️ Conteúdo sensível — nunca logar. |
| `tokenExpiresAt` | `tokenExpiresAt` | datetime | sim |  |  |  |
| `consentAcceptedAt` | `consentAcceptedAt` | datetime | sim |  |  |  |
| `consentVersion` | `consentVersion` | varchar(64) | sim |  |  |  |
| `consentIp` | `consentIp` | varchar(64) | sim |  |  |  |
| `consentUserAgent` | `consentUserAgent` | varchar(255) | sim |  |  |  |
| `status` | `status` | varchar(32) | não | pending |  | Estado operacional da conta: - pending: anfitrião iniciou o connect, aguardando validação - active: validada, já houve pelo menos 1 listagem importada com sucesso - error: credencial recusada (401/403) ou falhas duras repetidas (ver lastErrorAt) - disconnected: usuário desconectou voluntariamente |
| `lastSyncAt` | `lastSyncAt` | datetime | sim |  |  |  |
| `lastErrorAt` | `lastErrorAt` | datetime | sim |  |  |  |
| `lastErrorMessage` | `lastErrorMessage` | varchar(255) | sim |  |  |  |
| `consecutiveFailures` | `consecutiveFailures` | int | não | 0 |  | Falhas duras consecutivas (não-auth). Timeouts e 5xx não derrubam a conta; só 401/403 ou N falhas seguidas (STAYS_ACCOUNT_ERROR_THRESHOLD) viram `error`. Zera a cada chamada bem-sucedida. |
| `maxIncreasePercent` | `maxIncreasePercent` | int | não | 25 |  | Teto de variação % aplicado no modo autônomo. Default: 25% para cima e 20% para baixo — evita que um erro no KNN cause movimento grotesco. Usuário pode ajustar na UI. |
| `maxDecreasePercent` | `maxDecreasePercent` | int | não | 20 |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `user_id` | `user` | varchar(36) | não |  | UNIQUE, FK |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| one-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |
| one-to-many | `listings` | `stays_listings` | (lado inverso) |  |  |

Índices e unicidades:

- `IDX_3e7fc514d8924977dbb7f924f2` (UNIQUE): `user_id`
- `REL_3e7fc514d8924977dbb7f924f2` (UNIQUE): `user_id`

### `stays_listings`

- Entidade: `StaysListing` (`src/entities/stays-listing.entity.ts`)
- Domínio: Imóveis, anúncios e Stays
- Descrição: Cadastro externo Stays com vínculo opcional a um imóvel interno (`List`). O vínculo é feito pelo anfitrião (PUT /stays/listings/:id/property), com sugestões automáticas que ele confirma. Um imóvel Urban fica ligado a no máximo um listing da mesma conta (evita dois pushes para o mesmo imóvel). Se o anfitrião tiver imóveis na Urban AI que NÃO têm listing Stays correspondente, simplesmente não criamos linha aqui — o modo autônomo é desativado por imóvel, não por conta.

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `staysListingId` | `staysListingId` | varchar(64) | não |  | UNIQUE (composto) | ID do listing no Stays (formato Stays — string alfanumérica). |
| `title` | `title` | varchar(255) | sim |  |  | Dados cacheados da última sync — título, endereço curto, etc. Útil para exibir no painel sem bater na API Stays a cada render. |
| `shortAddress` | `shortAddress` | varchar(255) | sim |  |  |  |
| `basePriceCents` | `basePriceCents` | int | sim |  |  |  |
| `providerMetadata` | `providerMetadata` | json | sim |  |  |  |
| `operationMode` | `operationMode` | varchar(32) | não | inherit |  | Flag por listing — o anfitrião pode escolher quais imóveis usam o modo autônomo e quais ficam em recomendação manual, independente do `user.operationMode` global (que vira default). |
| `active` | `active` | tinyint | não | true |  |  |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `stays_account_id` | `account` | varchar(36) | não |  | UNIQUE (composto), IDX, FK |  |
| `propriedade_id` | `propriedade` | varchar(36) | sim |  | IDX, FK | Imóvel interno Urban AI (entidade List). Nullable = listing Stays que ainda não foi casado com nenhum imóvel Urban AI (pode acontecer se o anfitrião conectou mas ainda não cadastrou o imóvel na Urban AI). |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| many-to-one | `account` | `stays_accounts` | stays_account_id | CASCADE | NO ACTION |
| many-to-one | `propriedade` | `list` | propriedade_id | SET NULL | NO ACTION |

Índices e unicidades:

- `IDX_317422d753b6177634bb34ce10`: `stays_account_id`, `propriedade_id`
- `IDX_stays_listings_account_remote` (UNIQUE): `stays_account_id`, `staysListingId`

### `user`

- Entidade: `User` (`src/entities/user.entity.ts`)
- Domínio: Usuários e autenticação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `username` | `username` | varchar(255) | não |  |  |  |
| `email` | `email` | varchar(255) | não |  | UNIQUE |  |
| `password` | `password` | varchar(255) | não |  |  |  |
| `createdAt` | `createdAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |
| `distance_km` | `distanceKm` | double | sim | 30 |  | → Nova coluna para distância em km |
| `ativo` | `ativo` | tinyint | não | true |  |  |
| `phone` | `phone` | varchar(255) | sim |  |  |  |
| `company` | `company` | varchar(255) | sim |  |  |  |
| `pricingStrategy` | `pricingStrategy` | varchar(255) | sim | conservative |  | 'conservative' \| 'balanced' \| 'aggressive' \| 'ai' |
| `operationMode` | `operationMode` | varchar(255) | sim | notifications |  | 'notifications' \| 'auto' |
| `percentualInicial` | `percentualInicial` | decimal(5,2) | sim |  |  |  |
| `percentualFinal` | `percentualFinal` | decimal(5,2) | sim |  |  |  |
| `airbnbHostId` | `airbnbHostId` | varchar(255) | sim |  |  |  |
| `role` | `role` | varchar(16) | não | host |  | Papel do usuário na plataforma. - 'host' (default): anfitrião comum - 'admin': operador Urban AI (equipe interna, contractor) - 'support': leitura ampla mas sem mutação destrutiva Usado pelo `RolesGuard` para proteger endpoints administrativos. Atribuição manual via SQL ou endpoint admin (após o primeiro admin existir). |
| `onboardingDripLastDay` | `onboardingDripLastDay` | int | sim | NULL |  | Tracking do drip de onboarding (gap H9 do roadmap). `onboardingDripLastDay` = último dia D{N} enviado (1, 3, 7); null se nenhum. `onboardingDripLastSentAt` = timestamp do último envio bem-sucedido. Usado pelo `OnboardingDripService` para garantir idempotência entre execuções diárias do cron e dar observability no admin. |
| `onboardingDripLastSentAt` | `onboardingDripLastSentAt` | timestamp | sim | NULL |  |  |
| `email_verified_at` | `emailVerifiedAt` | timestamp | sim | NULL |  | Quando o e-mail foi comprovado (código de confirmação, convite da waitlist ou login Google com e-mail verificado). null = ainda não verificado. Diferente de `ativo` (bloqueio administrativo): contas anteriores a esta coluna foram preenchidas pela migration AddUserEmailVerifiedAt. |
| `sessions_valid_after` | `sessionsValidAfter` | datetime | sim | NULL |  | Corte de sessões: access tokens (JWT) emitidos antes deste instante são recusados pelo JwtStrategy. Atualizado quando a senha é redefinida/trocada, junto da revogação dos refresh tokens. null = nenhum corte. Só lida/escrita por common/session-cutoff.ts (tolera migration pendente). |
| `terms_accepted_at` | `termsAcceptedAt` | timestamp | sim | NULL |  | Aceite dos Termos de Uso/Privacidade no cadastro (prova de consentimento). null = não registrado (contas anteriores ao campo e logins Google, que ainda não passam por tela de aceite). |
| `terms_version` | `termsVersion` | varchar(32) | sim | NULL |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| one-to-many | `notifications` | `notifications` | (lado inverso) |  |  |

Índices e unicidades:

- `IDX_e12875dfb3b1d92d7d7c5377e2` (UNIQUE): `email`

### `user_communication_preferences`

- Entidade: `UserCommunicationPreferences` (`src/entities/user-communication-preferences.entity.ts`)
- Domínio: Notificações e comunicação

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `user_id` | `userId` | varchar(36) | não |  | UNIQUE, FK |  |
| `email_pricing` | `emailPricing` | tinyint | não | true |  |  |
| `push_pricing` | `pushPricing` | tinyint | não | true |  |  |
| `push_events` | `pushEvents` | tinyint | não | true |  |  |
| `weekly_report` | `weeklyReport` | tinyint | não | true |  |  |
| `onboarding_emails` | `onboardingEmails` | tinyint | não | true |  |  |
| `marketing` | `marketing` | tinyint | não | false |  |  |
| `stays_alerts` | `staysAlerts` | tinyint | não | true |  |  |
| `billing_alerts` | `billingAlerts` | tinyint | não | true |  |  |
| `owner_reports` | `ownerReports` | tinyint | não | true |  | Enviar ao proprietário o relatório mensal e receber o lembrete de fim de mês (ADR 0027). |
| `createdAt` | `createdAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | timestamp | não | CURRENT_TIMESTAMP(6) |  |  |

Relações:

| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |
| --- | --- | --- | --- | --- | --- |
| one-to-one | `user` | `user` | user_id | CASCADE | NO ACTION |

Índices e unicidades:

- `IDX_a453511f538784d3ba97613827` (UNIQUE): `user_id`
- `REL_a453511f538784d3ba97613827` (UNIQUE): `user_id`

### `waitlist`

- Entidade: `Waitlist` (`src/entities/waitlist.entity.ts`)
- Domínio: Aquisição (waitlist e contato)
- Descrição: Lista de espera de pré-lançamento (F8.2). Quando `PRELAUNCH_MODE=true` no backend, `POST /auth/register` desvia para criar uma `Waitlist` em vez de uma `User`. Com isso conseguimos: - Mostrar a tela de login real (users existentes seguem entrando) - Capturar demanda de novos interessados sem expor o sistema - Construir lista priorizada para o beta fechado da F7 `position` é calculado no service ao inserir a linha. Usado para mostrar "você é o #N na fila". `referralCode` é gerado no service ao criar a row (8 chars URL-safe). `referredBy` aponta pro `referralCode` de quem indicou (nullable). Quando usado, sobe a posição efetiva do indicador (lógica no service).

| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `id` | varchar(36) | não |  | PK, uuid auto |  |
| `position` | `position` | int | não |  | UNIQUE | Posição na fila, calculada pelo service no cadastro. |
| `email` | `email` | varchar(255) | não |  | UNIQUE |  |
| `name` | `name` | varchar(128) | sim |  |  |  |
| `phone` | `phone` | varchar(32) | sim |  |  |  |
| `source` | `source` | varchar(64) | não | unknown | IDX | Origem do cadastro — útil para medir conversão por canal: - 'landing-pre' (página /lancamento) - 'home' (form na home) - 'campaign-meta', 'campaign-google', 'organic', 'partner-stays', etc. |
| `referralCode` | `referralCode` | varchar(16) | não |  | UNIQUE | Código próprio da entry, formato URL-safe 8 chars (ex: 'k7m2x9pq'). |
| `referredBy` | `referredBy` | varchar(16) | sim |  |  | Code de quem indicou esta entry (lookup contra outro `referralCode`). |
| `referralsCount` | `referralsCount` | int | não | 0 |  | Quantas pessoas usaram o `referralCode` desta entry como `referredBy`. Cache para não precisar COUNT em cada exibição. Recalculado quando uma referral nova chega. |
| `status` | `status` | varchar(16) | não | pending |  | Status da entrada: - 'pending': aguardando convite - 'invited': admin clicou "Convidar" e magic link foi enviado - 'converted': user clicou no magic link, virou User real - 'declined': user pediu pra ser removido (ou bounce de email) |
| `invitedAt` | `invitedAt` | datetime | sim |  |  |  |
| `convertedAt` | `convertedAt` | datetime | sim |  |  |  |
| `inviteToken` | `inviteToken` | varchar(64) | sim |  |  | Token único do magic link de convite (NULL até o admin convidar). Expira em 7 dias — checagem feita no controller de aceite. |
| `inviteTokenExpiresAt` | `inviteTokenExpiresAt` | datetime | sim |  |  |  |
| `signupIp` | `signupIp` | varchar(45) | sim |  |  | IP de origem do cadastro (auditoria + antifraude). |
| `userAgent` | `userAgent` | varchar(255) | sim |  |  | UA do navegador no cadastro. |
| `termsAcceptedAt` | `termsAcceptedAt` | datetime | sim |  |  | Aceite dos Termos de Uso/Política de Privacidade no cadastro (prova de consentimento). null = linhas anteriores ao campo. |
| `termsVersion` | `termsVersion` | varchar(32) | sim |  |  | Versão dos termos aceita (`TERMS_VERSION` no momento do cadastro). |
| `notes` | `notes` | text | sim |  |  | Notas internas do admin (motivo de prioridade, contexto). |
| `createdAt` | `createdAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |
| `updatedAt` | `updatedAt` | datetime | não | CURRENT_TIMESTAMP(6) |  |  |

Índices e unicidades:

- `IDX_2221cffeeb64bff14201bd5b3d` (UNIQUE): `email`
- `IDX_2da311a3fc67277b1f979359f1` (UNIQUE): `referralCode`
- `IDX_3086852f8e357a80058a7d5244`: `source`
- `IDX_f7f0bed1e6591245afbabc39d8` (UNIQUE): `position`

<!-- END GENERATED: data-dictionary -->
