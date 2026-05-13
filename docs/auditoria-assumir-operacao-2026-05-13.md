# Urban AI - Auditoria para Assumir Operacao

**Data:** 2026-05-13  
**Objetivo:** entender o sistema em profundidade antes de assumir desenvolvimento e operacao.  
**Status:** documento vivo, em revisao continua.

---

## 1. Escopo Inicial

Esta auditoria cobre:

- Backend NestJS (`urban-ai-backend-main/`)
- Frontend Next.js (`Urban-front-main/`)
- Pipeline Prefect (`urban-pipeline-main/`)
- Webscraping Scrapy/Scrapyd (`urban-webscraping-main/`)
- Motor KNN legado (`urban-ai-knn-main/`) e motor embedado no backend
- Documentacao operacional (`docs/`, `CHANGELOG.md`, ADRs, runbooks)
- Opensquad interno (`_opensquad/`, `squads/`) como ferramenta operacional, nao produto

---

## 2. Verificacoes Executadas

### 2.0 Execucao Inicial de Correcao - 2026-05-13

Primeira leva aplicada antes de continuar evolucao funcional:

- `DELETE /auth/:id` e `PUT /auth/:id/update` restringidos a admin autenticado.
- Rotas operacionais pesadas de mapas, cron, pricing, mailer e debug protegidas com `JwtAuthGuard + RolesGuard`.
- `delete-address-and-list/:id` agora valida que o endereco pertence ao usuario autenticado.
- Reset de senha deixou de usar `userId` no link e passou a usar token aleatorio, hash no banco, expiracao de 30 minutos e uso unico.
- `GET /email/:id` agora exige JWT, permite apenas o proprio usuario e remove senha/hash da resposta.
- Frontend passou a enviar token no reset de senha e a chamar `/auth/logout` antes de limpar `localStorage`.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Frontend `tsc --noEmit`: passou.
- Backend Jest: 141/141 testes passaram.

### 2.0.1 Segunda Leva - Auth, Ownership, Sessao e Operacao

Itens aplicados apos a primeira correcao:

- `POST /notifications/:userId` restrito a admin autenticado.
- `PATCH /notifications/:id/opened` agora exige JWT e valida que a notificacao pertence ao usuario.
- `PATCH /sugestoes-preco/:id/aceito` reativado com `JwtAuthGuard` e ownership.
- `PATCH /sugestoes-preco/:id/aplicado` agora valida ownership antes de gravar ground truth.
- Leituras internas de eventos/precos por endereco em `/propriedades` passaram a exigir JWT e filtrar pelo dono autenticado.
- `GET /propriedades/:id` passou a buscar endereco pelo usuario autenticado.
- `POST /processos/pricing` deixou de enfileirar rotina global; agora exige `userId` e `propertyAdressId` e processa somente a propriedade informada.
- Frontend iniciou migracao real para cookie httpOnly: guards consultam `/auth/me`, login/cadastro nao gravam novo `accessToken` em `localStorage`, Chainlit usa `credentials: include`.
- Criados runbooks:
  - `docs/runbooks/assuncao-operacional.md`
  - `docs/runbooks/smoke-tests-operacionais.md`
  - `docs/backlog-produto-pos-assuncao.md`

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Frontend `tsc --noEmit`: passou.
- Backend Jest: 141/141 testes passaram.

### 2.1 Testes e Typecheck

| Area | Comando / Metodo | Resultado |
|---|---|---|
| Backend NestJS | Jest via Node runtime embutido | **141/141 testes passaram** |
| Backend NestJS | `tsc --noEmit` via Node runtime embutido | **Passou** |
| Frontend Next.js | `tsc --noEmit` via Node runtime embutido | **Passou** |
| Webscraping | `uv run pytest -q` | **83/83 testes passaram** |
| Pipeline Prefect | `uv run pytest -q` | **Falhou na coleta**: scripts raiz importam Playwright sem dependencia declarada |
| Pipeline Prefect | `uv run pytest tests -q` | **37 passaram, 10 erros** por tentativa de conectar em MySQL local indisponivel |

Observacao: `npm`/`npx` nao estavam no PATH desta sessao; os comandos Node foram executados com o runtime embutido do Codex.

### 2.2 Estado Git

- Branch: `main...origin/main`
- Havia `.codex/` untracked antes da auditoria.
- Artefatos gerados por typecheck/cache foram removidos ou revertidos apos a validacao.

---

## 3. Achados P0 - Resolver Antes de Operar com Usuarios Reais

### P0-001 - Endpoints de usuario sem autenticacao permitem alteracao/destruicao de conta

**Evidencia:**

- `urban-ai-backend-main/src/auth/auth.controller.ts`
  - `DELETE /auth/:id` em torno da linha 268 chama `deleteUser(id)` sem `JwtAuthGuard`.
  - `PUT /auth/:id/update` em torno da linha 311 chama `update(id, data)` sem `JwtAuthGuard`.

**Risco:** qualquer cliente que descubra/tenha um UUID pode tentar deletar ou alterar dados de usuario, incluindo senha.

**Recomendacao inicial:**

- Remover endpoints legados se nao forem usados.
- Se forem necessarios, restringir a admin com `JwtAuthGuard + RolesGuard`.
- Para update do proprio usuario, usar apenas rota autenticada baseada em `req.user.userId`.

### P0-002 - Reset de senha baseado em `userId`, sem token assinado

**Evidencia:**

- `urban-ai-backend-main/src/email/email.service.ts`
  - `forgotPassword()` monta link como `${RESET_PASS_URL}/${userId}`.
  - `confirmPassword(idUsuario, password)` atualiza senha diretamente para o usuario informado.
- `urban-ai-backend-main/src/email/email.controller.ts`
  - `POST /email/update-password` chama `confirmPassword(body.userId, body.pass)` sem autenticacao.

**Risco:** se um atacante souber ou inferir o `userId`, consegue resetar senha sem posse do e-mail.

**Recomendacao inicial:**

- Criar tabela/token de reset aleatorio, com hash no banco, expiracao curta e uso unico.
- Link deve conter token, nunca `userId`.
- `POST /reset-password` deve validar token antes de trocar senha.

### P0-003 - Endpoints operacionais publicos disparam jobs, chamadas externas e custos

**Evidencia:**

- `urban-ai-backend-main/src/maps/maps.controller.ts`
  - `PATCH /maps/events/:eventId/location`
  - `POST /maps/events/update-all-locations`
  - `POST /maps/processar-lat-long-eventos`
  - `POST /maps/processar-lat-long-adress`
  - `POST /maps/processar-analises`
- `urban-ai-backend-main/src/cron/cron.controller.ts`
  - `GET /cron/analises-aceitas`
  - `GET /cron/buscar-aceitas-teste`
  - `GET /cron/refresh-metadata`
- `urban-ai-backend-main/src/mailer/mailer.controller.ts`
  - `POST /mailer/send`

**Risco:** usuario anonimo pode disparar geocoding, processamento pesado, re-scraping e envio de e-mail. Isso abre risco de custo, abuso e degradacao.

**Recomendacao inicial:**

- Proteger endpoints manuais com `JwtAuthGuard + RolesGuard('admin')`.
- Separar endpoints publicos, jobs internos e ferramentas admin.
- Adicionar throttling especifico em endpoints que chamam Google Maps, scraping, e-mail ou processamento batch.

### P0-004 - Endpoint de teste Sentry publico

**Evidencia:**

- `urban-ai-backend-main/src/app.controller.ts`
  - `GET /debug/sentry-test` sempre dispara `InternalServerErrorException`.

**Risco:** qualquer pessoa pode gerar erro artificial, poluir alertas e mascarar incidente real.

**Recomendacao inicial:**

- Remover em producao ou proteger por `APP_ENV !== production`.
- Alternativa: admin-only.

### P0-005 - Usuario autenticado pode deletar endereco/list de outro usuario se souber o ID

**Evidencia:**

- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts`
  - `DELETE /propriedades/address/:id` tem `JwtAuthGuard`, mas passa apenas `id` para o service.
- `urban-ai-backend-main/src/propriedades/propriedade.service.ts`
  - `deleteAddressAndList(addressId)` busca `Address` por `id` sem filtrar `user`.
  - Depois deleta o endereco e, se for o ultimo, deleta o `List`.

**Risco:** um usuario autenticado pode excluir dados de outro usuario se obtiver ou adivinhar um UUID de endereco.

**Recomendacao inicial:**

- Alterar controller para passar `req.user.userId`.
- Alterar service para buscar `where: { id: addressId, user: { id: userId } }`.
- Adicionar teste unitario cobrindo tentativa cross-user.

### P0-006 - Rotas de mapas/processamento sem auth podem disparar processamento assíncrono sem controle

**Evidencia adicional:**

- `urban-ai-backend-main/src/maps/maps.controller.ts`
  - `processar-analises-by-property` usa auth, mas `processar-analises` nao.
  - `processar-lat-long-eventos` e `processar-lat-long-adress` iniciam tarefas e respondem imediatamente.

**Risco:** abuso externo pode gerar fila/processamento concorrente, custos de Google Maps e degradacao geral.

**Recomendacao inicial:**

- Admin-only para todos os endpoints manuais de processamento.
- Usar fila/lock/idempotencia para impedir concorrencia acidental.
- Manter cron interno separado de endpoint HTTP publico.

### P0-007 - Endpoint publico enfileira job pesado de pricing e ignora o `listId`

**Evidencia:**

- `urban-ai-backend-main/src/processos/processo.controller.ts`
  - `POST /processos/pricing` nao tem `JwtAuthGuard`.
  - Enfileira job Bull `processar-pricing` com `listId` vindo do body.
- `urban-ai-backend-main/src/processos/processos.processor.ts`
  - `handleEvento(job)` recebe `listId`, mas chama `simularRota('processar-lat-long-eventos')`.
  - `simularRota()` executa rotinas globais de lat/lng e depois chama `POST ${API_URL}/maps/processar-analises`.

**Risco:** qualquer cliente anonimo consegue acionar job pesado que pode atualizar todos os eventos/enderecos e disparar analises globais. O parametro `listId` passa uma falsa impressao de escopo, mas o processor nao limita o processamento a esse imovel.

**Recomendacao inicial:**

- Proteger `POST /processos/pricing` com `JwtAuthGuard + RolesGuard('admin')`, ou remover se for legado.
- Corrigir o processor para respeitar `listId` quando a intencao for job por imovel.
- Eliminar chamada HTTP interna para `/maps/processar-analises` e chamar service/fila diretamente com escopo e lock.

---

## 4. Achados P1 - Alto Impacto, Mas Nao Necessariamente Bloqueantes

### P1-001 - Migracao de auth cookie esta incompleta no frontend

**Evidencia:**

- Backend ja seta cookie httpOnly e refresh rotation.
- `urban-ai-backend-main/src/auth/auth.controller.ts` ainda retorna `accessToken` no body por retrocompatibilidade.
- `Urban-front-main/src/app/service/api.ts` ainda injeta `Authorization` a partir de `localStorage.getItem("accessToken")`.

**Risco:** qualquer XSS no frontend ainda pode roubar access token enquanto a retrocompatibilidade existir.

**Recomendacao inicial:**

- Front deve usar cookies com `withCredentials`.
- Remover `accessToken` do body de `login`, `google`, `refresh`.
- Remover uso de `localStorage` para token.

### P1-002 - Dump SQL legado versionado

**Evidencia:**

- `docs/dump-ai_urban-202603131344.sql` esta rastreado.
- `.gitignore` ja bloqueia `*.sql`, mas o dump entrou antes da regra.

**Risco:** possivel exposicao de dados, aumento de superficie em caso de compartilhamento do repo e ruido operacional.

**Recomendacao inicial:**

- Confirmar se contem dados reais/sensiveis.
- Remover do Git se nao for absolutamente necessario.
- Se o repo algum dia virar publico ou for compartilhado com terceiros, considerar purge de historico.

### P1-003 - Pipeline tem testes misturados com scripts experimentais

**Evidencia:**

- `urban-pipeline-main/test_hash.py`, `test_state.py`, `test_stealth.py` importam `playwright.async_api`, mas `playwright` nao esta em `pyproject.toml`.
- `uv run pytest -q` falha na coleta antes de chegar na suite formal.

**Risco:** CI/local test quebra de forma ruidosa; dificulta saber se o pipeline real esta saudavel.

**Recomendacao inicial:**

- Mover scripts experimentais para `scratch/` ou renomear para nao serem coletados como testes.
- Se forem testes oficiais, declarar `playwright` e `playwright-stealth` nas dependencias dev.

### P1-004 - Pipeline E2E assume MySQL local disponivel

**Evidencia:**

- `uv run pytest tests -q` teve 37 testes passando e 10 erros por conexao recusada em `localhost:3306`.

**Risco:** validacao E2E nao e reprodutivel sem setup explicito.

**Recomendacao inicial:**

- Documentar pre-requisito local ou usar testcontainers de forma obrigatoria.
- Separar unit/integration/e2e por markers.
- Fazer CI rodar o conjunto certo com service container MySQL.

### P1-005 - Endpoints de leitura de dados de usuario/propriedade sem auth

**Evidencia:**

- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts`
  - `GET /propriedades/eventos-analisados-com-price` sem auth.
  - `GET /propriedades/eventos-analisados-com-price-para-maps` sem auth.
  - `GET /propriedades/quantidade-eventos/:usuarioId` sem auth.
  - `GET /propriedades/:id/coordinates` sem auth.
- `urban-ai-backend-main/src/evento/evento.controller.ts`
  - `GET /event?propriedadeId=...` sem auth.
- `urban-ai-backend-main/src/connect/connect.controller.ts`
  - `GET /connect/user-managed-listings/:userId` sem auth, mas aqui o `userId` parece ser hostId do Airbnb, nao `User.id`; precisa confirmar uso.

**Risco:** vazamento de dados de analises, eventos por propriedade e metadados operacionais caso IDs sejam conhecidos.

**Recomendacao inicial:**

- Classificar quais endpoints sao publicos por design.
- Para dados Urban AI internos, exigir auth e ownership.
- Para consultas publicas de Airbnb, renomear/isolá-las em namespace publico explicito.

### P1-006 - Endpoints de notificacao e sugestao expostos por ID

**Evidencia:**

- `urban-ai-backend-main/src/notifications/notification.controller.ts`
  - `POST /notifications/:userId` sem auth.
  - `PATCH /notifications/:id/opened` sem auth.
- `urban-ai-backend-main/src/sugestao/sugestion.controller.ts`
  - `PATCH /sugestoes-preco/:id/aceito` esta com `@UseGuards` comentado.
  - `PATCH /sugestoes-preco/:id/aplicado` tem auth.

**Risco:** clientes anonimos podem criar notificacoes para usuarios, marcar notificacoes como abertas ou aceitar sugestoes por ID.

**Recomendacao inicial:**

- Proteger com auth.
- Para notificacao: criacao deve ser admin/internal service, nao publico.
- Para sugestao: validar ownership da sugestao antes de alterar estado.

### P1-007 - Stays salva access token em texto claro

**Evidencia:**

- `urban-ai-backend-main/src/stays/stays.service.ts`
  - `connectAccount()` persiste `account.accessToken = input.accessToken`.
  - `disconnectAccount()` zera o token, mas enquanto conectado ele fica armazenado direto.

**Risco:** vazamento de DB concede acesso direto a contas Stays dos clientes.

**Recomendacao inicial:**

- Criptografar tokens em repouso com chave de aplicacao fora do DB.
- Ideal: OAuth com refresh rotation quando Stays disponibilizar.
- Pelo menos marcar token como segredo operacional no inventario de dados LGPD.

### P1-008 - Logs ainda imprimem payloads e dados de usuario em rotas sensiveis

**Evidencia:**

- `urban-ai-backend-main/src/connect/connect.service.ts`
  - loga payload completo de propriedades e enderecos.
- `urban-ai-backend-main/src/email/email.controller.ts`
  - `updatePassword()` faz `console.log("usuario", body)`, incluindo senha/hash enviado.
- `urban-ai-backend-main/src/email/email.service.ts`
  - `getProfileById()` loga usuario completo.
  - `confirmPassword()` loga usuario e id.

**Risco:** logs podem conter PII, senha pre-hash ou dados de propriedade.

**Recomendacao inicial:**

- Remover logs de payload/usuario de rotas sensiveis.
- Adotar logger estruturado com redaction.
- Definir politica de log: nunca senha/token/e-mail completo em producao.

### P1-009 - Frontend atual depende amplamente de `localStorage` para autenticacao

**Evidencia:**

- `Urban-front-main/src/app/context/AuthContext.tsx`
  - Inicializa autenticacao lendo `localStorage.getItem('accessToken')`.
  - Salva token de NextAuth/backend no `localStorage`.
- `Urban-front-main/src/app/context/AuthGuard.tsx`
  - Decide acesso apenas por existencia de token local.
- `Urban-front-main/src/app/context/PaymentCheckGuard.tsx`
  - Redireciona se nao houver token local.
- `Urban-front-main/src/app/(home)/page.tsx`
  - Login salva `response.data.accessToken` no `localStorage`.
- `Urban-front-main/src/app/create/page.tsx`
  - Cadastro + auto-login salva `accessToken` no `localStorage`.
- `Urban-front-main/src/app/componentes/ChainlitCopilot.tsx`
  - Usa `Authorization: Bearer ${accessToken}` vindo de `localStorage`.

**Risco:** a protecao httpOnly do backend ainda nao vira protecao real enquanto o token tambem fica exposto ao JavaScript.

**Recomendacao inicial:**

- Migrar `api.ts` para `withCredentials: true`.
- Autenticacao client-side deve perguntar ao backend (`/auth/me`) e nao depender de token local.
- Remover `AuthGuard` baseado em `localStorage`.
- Chainlit/Copilot precisa receber dados via backend/session segura, nao ler token direto.

### P1-010 - Frontend usa o fluxo de reset inseguro em producao

**Evidencia:**

- `Urban-front-main/src/app/request-reset-password/page.tsx`
  - Chama `forgotPassword(email)`, que usa `/email/forgot-password`.
- `Urban-front-main/src/app/reset-password/[id]/page.tsx`
  - Interpreta `[id]` como `userId`.
  - Chama `updatePassword(userId, hashedPassword)`.
- `Urban-front-main/src/app/service/api.ts`
  - `updatePassword()` chama `POST /email/update-password`.

**Risco:** confirma que o achado P0-002 nao e codigo morto; a UI oficial usa o reset por `userId`.

**Recomendacao inicial:**

- Substituir rota `[id]` por `[token]`.
- Trocar chamadas para endpoints novos de token de reset.
- Invalidar links antigos assim que o novo fluxo entrar.

### P1-011 - Auth proxy do Scrapyd fica sem autenticacao se `SCRAPYD_API_KEY` nao estiver setada

**Evidencia:**

- `urban-webscraping-main/auth_proxy.py`
  - `_check_auth()` permite todas as chamadas quando `SCRAPYD_API_KEY` nao esta configurada, por compatibilidade.

**Risco:** um erro de env em producao transforma o Scrapyd proxy em endpoint operacional aberto. Como ele agenda spiders, isso pode gerar abuso, custo e carga em sites terceiros.

**Recomendacao inicial:**

- Em producao, falhar o boot se `SCRAPYD_API_KEY` estiver ausente.
- Manter modo sem auth somente em `APP_ENV=development` ou equivalente.
- Adicionar check operacional no deploy/health.

### P1-012 - Coleta diaria do webscraping engole falhas e pode parecer saudavel sem estar

**Evidencia:**

- `urban-webscraping-main/auth_proxy.py`
  - `cron_worker` roda `scripts/run_all_collectors.sh` no boot e depois a cada 24h a partir do boot.
- `urban-webscraping-main/scripts/run_all_collectors.sh`
  - Usa `set -e`, mas cada coletor tem `|| echo "Aviso: ... falhou"`, entao a falha nao derruba o script.
  - Agendamentos Scrapyd via `curl` tambem falham apenas com aviso.

**Risco:** coletores podem falhar por dias sem falhar o job em nivel de processo. A operacao so percebe pelo volume de eventos no painel/admin, nao por alerta direto do coletor.

**Recomendacao inicial:**

- Registrar sucesso/falha por coletor em tabela/log estruturado.
- Retornar exit code nao-zero quando fontes criticas falham.
- Ter alerta por fonte sem dados em 24/48h, usando `/admin/collectors-health` ou job externo.
- Migrar agendamento para cron real ou scheduler gerenciado, nao "24h depois do boot".

### P1-013 - Buckets/data lake divergentes entre webscraping e pipeline Prefect

**Evidencia:**

- `urban-webscraping-main/urban_webscrapping/pipelines.py`
  - Pipelines S3 usam bucket hardcoded `urbanai-data-lake`.
- `urban-pipeline-main/serve.py`
  - Prefect usa `S3_BUCKET_NAME = "urban-ai-data"`.

**Risco:** parte do sistema pode escrever em um bucket enquanto outro le em outro. Isso cria perda silenciosa de dados ou bronze layer duplicada/obsoleta.

**Recomendacao inicial:**

- Definir um unico bucket oficial por ambiente.
- Remover nomes hardcoded e carregar via env/Prefect Secret.
- Documentar ownership: o caminho oficial hoje parece ser ingestao via backend `/events/ingest`, enquanto S3/Prefect esta mais proximo de legado/bronze.

### P1-014 - Ha dois caminhos de ingestao/agendamento de eventos que podem duplicar ou divergir

**Evidencia:**

- `urban-webscraping-main/auth_proxy.py` + `scripts/run_all_collectors.sh` rodam coletores novos e agendam spiders legados localmente.
- `urban-pipeline-main/serve.py` agenda Prefect `trigger_all_spiders` as 03:00 e `raw_data_extraction_and_dump` as 04:00.
- `urban-pipeline-main/spiders_pipeline/main.py` tambem agenda spiders legacy via Scrapyd.
- `urban-webscraping-main/urban_webscrapping/settings.py` atualmente ativa `UrbanIngestPipeline`, que envia direto para o backend.

**Risco:** se Prefect e auth_proxy estiverem ativos juntos, spiders legacy podem rodar duplicados. Se apenas um estiver ativo, documentacao antiga pode induzir operacao ao caminho errado. Tambem ha diferenca entre gravar S3/MySQL e enviar direto para `/events/ingest`.

**Recomendacao inicial:**

- Escolher o caminho canonical de producao: "collectors -> backend ingest" ou "collectors -> S3 -> Prefect -> DB".
- Deixar o caminho legado explicitamente desativado.
- Criar diagrama de dados e runbook de replay/backfill.

### P1-015 - Ingestao dos coletores depende de login com usuario/senha e do `accessToken` no body

**Evidencia:**

- `urban-webscraping-main/urban_webscrapping/utils/urban_backend_client.py`
  - Faz login em `/auth/login` com `URBAN_COLLECTOR_EMAIL` e `URBAN_COLLECTOR_PASSWORD`.
  - Espera `accessToken` no body e usa `Authorization: Bearer`.
- Backend esta no meio da migracao para cookie httpOnly, mas ainda retorna token por retrocompatibilidade.

**Risco:** a migracao para remover access token do body quebrara a ingestao se nao houver alternativa. Alem disso, credencial de usuario tecnico em ambiente de scraping vira segredo de alto impacto.

**Recomendacao inicial:**

- Criar autenticacao de service account/API key com escopo exclusivo para `/events/ingest`.
- Rotacionar credenciais do coletor.
- Separar usuario humano de usuario tecnico e auditar eventos por `source`.

### P1-016 - Motor de IA/pricing ainda e majoritariamente regra heuristica, nao XGBoost em producao

**Evidencia:**

- `urban-ai-backend-main/src/knn-engine/strategies/xgboost-pricing.strategy.ts`
  - `isReady()` retorna `false` enquanto `modelLoaded` nunca e setado para `true`.
  - `loadModel()` e stub.
  - `suggestPrice()` ainda lanca erro de inferencia nao implementada.
- `urban-ai-backend-main/src/knn-engine/strategies/adaptive-pricing.strategy.ts`
  - Default `adaptive`, mas cai para regras quando XGBoost nao esta pronto.
- `urban-ai-backend-main/src/knn-engine/feature-engineering.service.ts`
  - Geocoding, metro distance e amenities ainda sao skeleton/TODO.
- `urban-ai-backend-main/src/knn-engine/isochrone.ts`
  - Travel time e calculado por heuristica Turf/velocidade media, nao por API real de rotas.

**Risco:** pitch/operacao podem superestimar o estado real da IA. O produto tem motor de regras sofisticado com base geoespacial e caminho arquitetural bom, mas o moat ML ainda depende de dataset, feature engineering e modelo treinado.

**Recomendacao inicial:**

- Comunicar externamente como "pricing engine com IA/enriquecimento e regras adaptativas" ate XGBoost real estar validado.
- Definir gate operacional para dizer "ML ativo": artefato carregado, shadow log persistido, MAPE em amostra minima e rollback.
- Priorizar feature engineering real antes de promover qualquer modelo.

### P1-017 - Snapshot diario de dataset proprio ainda nao captura preco sem resolver externo

**Evidencia:**

- `urban-ai-backend-main/src/knn-engine/dataset-collector.service.ts`
  - `recordOwnedListingsSnapshot()` so grava snapshot se `priceCentsResolver` for passado e retornar preco.
  - O cron `handleDailySnapshot()` chama `recordOwnedListingsSnapshot()` sem resolver.

**Risco:** a frente 1 do dataset proprietario pode registrar `captured=0` diariamente em producao, dando falsa sensacao de captura historica dos imoveis proprios. A coleta de comps nas analises ajuda, mas nao substitui serie temporal diaria de listings proprios.

**Recomendacao inicial:**

- Conectar o snapshot diario a Stays, Airbnb/GraphQL permitido ou campo interno confiavel de preco.
- Alertar quando `captured=0` por mais de 1 dia.
- Expor no admin a separacao `self_cron` vs `comp_extraction` para evitar interpretar comps como inventario proprio.

### P1-018 - Logout frontend remove token local, mas pode deixar refresh cookie ativo

**Evidencia:**

- `Urban-front-main/src/app/componentes/SideBar.tsx`
  - `handleLogout()` remove `accessToken` do `localStorage` e redireciona.
- Backend tem `POST /auth/logout` para limpar/revogar refresh cookie, mas o fluxo do sidebar nao o chama.

**Risco:** apos logout visual, o navegador pode continuar com cookie httpOnly valido, permitindo refresh/session revive em fluxos que usem cookie.

**Recomendacao inicial:**

- Logout do frontend deve chamar `/auth/logout` com credenciais/cookie.
- Depois limpar estado local apenas como complemento.

### P1-019 - Fluxo `post-login` redireciona para rota possivelmente inexistente

**Evidencia:**

- `Urban-front-main/src/app/post-login/page.tsx`
  - Se usuario ja tem endereco, redireciona para `/app`.
- No mapeamento inicial do frontend, as rotas principais sao `/dashboard`, `/properties`, `/maps`, `/painel`, `/plans`, etc.; `/app` nao apareceu como destino funcional.

**Risco:** login/onboarding pode cair em 404 ou rota errada dependendo do estado do usuario.

**Recomendacao inicial:**

- Confirmar rota principal oficial pos-login.
- Trocar para `/dashboard` ou rota canonical definida.

### P1-020 - Dashboard legado expoe metricas por `usuarioId` sem auth

**Evidencia:**

- `urban-ai-backend-main/src/dashboard/dashboard.controller.ts`
  - `GET /receita-projetada/:usuarioId` sem auth.
  - `GET /lucro-projetado/:usuarioId` sem auth.
  - `GET /quantidade-enderecos/:usuarioId` sem auth.
  - `GET /dados` e autenticado e usa `req.user.userId`, ou seja, ja existe caminho correto.

**Risco:** qualquer cliente com um UUID de usuario consegue consultar metricas financeiras/projetadas desse usuario.

**Recomendacao inicial:**

- Remover endpoints por `usuarioId` se forem legados.
- Substituir por `/dados` autenticado e scoped ao usuario.
- Se admin precisar consultar usuario especifico, criar rota admin com `RolesGuard`.

### P1-021 - `process-status` permite alterar status operacional sem auth

**Evidencia:**

- `urban-ai-backend-main/src/process/process.controller.ts`
  - `GET /process-status` sem auth.
  - `PUT /process-status` sem auth e aceita `{ status, errorMessage }`.

**Risco:** cliente anonimo pode marcar processo como `running`, `completed` ou `error`, poluindo UX/monitoramento e mascarando estado real.

**Recomendacao inicial:**

- `GET` pode ser publico somente se for status nao sensivel; caso contrario, admin-only.
- `PUT` deve ser admin/internal service-only.
- Preferir status derivado de jobs reais, nao campo mutavel por HTTP publico.

### P1-022 - Consultas externas Airbnb/RapidAPI estao publicas e sem throttle especifico

**Evidencia:**

- `urban-ai-backend-main/src/airbnb/airbnb.controller.ts`
  - `GET /airbnb/availability/:propertyId` publico.
  - `GET /airbnb/price/:propertyId` publico.
- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts`
  - `GET /propriedades/checkout-prices`, `/airbnb/room-info`, `/airbnb/room-basic-info`, `POST /airbnb/create-alert`, `/hostId`, `/quick-info`, `/getPropertyDetails/:id` publicos.
- `urban-ai-backend-main/src/airbnb/airbnb.service.ts`
  - Chama RapidAPI com chave da Urban AI.

**Risco:** abuso anonimo pode consumir quota/custo RapidAPI e consultar dados externos em nome da Urban AI. O throttler global ajuda, mas endpoints de custo precisam limite menor e/ou autenticacao.

**Recomendacao inicial:**

- Classificar quais endpoints sao necessarios antes do cadastro/onboarding.
- Aplicar `@Throttle` especifico e cache por `propertyId`/datas.
- Para dados usados em painel autenticado, exigir auth.

### P1-023 - Endpoint publico `GET /propriedades/ajuste-preco` contem chamada hardcoded e nao retorna calculo real

**Evidencia:**

- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts`
  - `GET /propriedades/ajuste-preco` recebe parametros de calculo, mas o calculo esta comentado.
  - Chama `buscarAddress("b54f06c8-44b2-436c-815b-9f7c19ba40dc")` com ID hardcoded e retorna `{ status: true }`.

**Risco:** endpoint parece ser ferramenta de teste deixada em producao; pode acessar dado especifico indevidamente e confunde clientes/operacao.

**Recomendacao inicial:**

- Remover endpoint se nao for usado.
- Se for ferramenta de pricing manual, implementar calculo real, auth e ownership.

### P1-024 - CI nao valida webscraping nem pipeline Prefect

**Evidencia:**

- `.github/workflows/ci.yml` executa backend typecheck/test/build/migrations e frontend typecheck/build/smoke opcional.
- Nao ha jobs para `urban-webscraping-main` nem `urban-pipeline-main`.
- Localmente, webscraping passou 83/83 testes, mas pipeline falhou por Playwright ausente e MySQL local.

**Risco:** regressao nos coletores ou pipeline de dados pode entrar em `main` sem bloqueio de CI.

**Recomendacao inicial:**

- Adicionar jobs Python separados: webscraping unit tests, pipeline unit tests, pipeline integration com MySQL service container.
- Separar testes experimentais do pipeline para `pytest` nao coletar arquivos raiz indevidos.

### P1-025 - Workflow de backup tem notificacao provavelmente inoperante e parser fragil de `DATABASE_URL`

**Evidencia:**

- `.github/workflows/backup-db.yml`
  - Steps de Slack usam `if: ${{ success() && env.SLACK_WEBHOOK != '' }}`, mas `SLACK_WEBHOOK` so e definido no `env` do proprio step. A condicao tende a avaliar vazio antes do step.
  - Parser shell de `DATABASE_URL` usa cortes por `:` e `@`, sem URL decoding.

**Risco:** falha de backup pode passar sem alerta. Senhas com caracteres especiais na URL podem quebrar o dump.

**Recomendacao inicial:**

- Mover `SLACK_WEBHOOK` para env do job ou checar diretamente `secrets.SLACK_BACKUP_WEBHOOK`.
- Usar parser robusto (`python`, `node`, `mysql_config_editor` ou variaveis separadas) e testar com senha contendo caracteres especiais.
- Adicionar restore drill mensal, nao apenas dump.

### P1-026 - Swagger publico pode expor superficie de ataque

**Evidencia:**

- `urban-ai-backend-main/src/main.ts`
  - `SwaggerModule.setup('api', app, document)` sempre habilita `/api`.

**Risco:** em producao, documentacao interativa facilita descoberta dos endpoints legados/publicos listados nesta auditoria.

**Recomendacao inicial:**

- Desabilitar Swagger em `APP_ENV=production` ou proteger por admin/basic auth.
- Manter aberto apenas em staging/dev.

### P1-027 - Arquivos `.env` reais existem localmente e estao ignorados, mas precisam entrar no inventario de secrets

**Evidencia:**

- `git status --ignored` mostra `.env` reais ignorados em:
  - `urban-ai-backend-main/.env`
  - `Urban-front-main/.env`
  - `Urban-front-main/.env.development`
  - `urban-webscraping-main/.env`
- Esses arquivos nao estao rastreados por Git, o que e correto.

**Risco:** para assumir operacao, precisamos saber quais secrets existem, onde estao provisionados e como rotacionar. O risco nao e Git neste momento; e dependencia operacional implicita em arquivos locais/Railway/GitHub Secrets.

**Recomendacao inicial:**

- Criar inventario de secrets por ambiente: local, staging, production, GitHub Actions, Railway, Prefect.
- Definir owner, data de rotacao e escopo de cada secret.
- Nunca colar valores reais no repo; registrar apenas nomes/uso.

### P1-028 - Migrations nao constroem um banco fresh funcional a partir do zero

**Evidencia:**

- `urban-ai-backend-main/src/migrations/1745500000000-Baseline.ts` e propositalmente vazio porque producao nasceu com `synchronize: true`.
- As migrations seguintes criam apenas tabelas/colunas pos-baseline.
- `CatchupFeatureEntities` pula foreign keys se tabelas base nao existirem.

**Risco:** em disaster recovery para banco vazio, ou staging fresh, `migration:run` pode deixar um schema parcial sem tabelas base (`user`, `list`, `addresses`, `events`, etc.). O job de CI "migrations dry-run against MySQL" valida que migrations rodam, mas nao valida que o schema resultante e utilizavel.

**Recomendacao inicial:**

- Criar baseline real do schema atual ou documentar que recovery obrigatoriamente parte de backup completo.
- Adicionar teste de schema fresh que sobe app ou valida entidades/tabelas esperadas apos migrations.
- Para operacao, manter runbook de restore a partir de backup como caminho principal.

### P1-029 - Migration de entidades novas tem divergencia de nomes/tipos vs entities atuais

**Evidencia:**

- `urban-ai-backend-main/src/entities/list.entity.ts`
  - Tabela `list`, primary key UUID string.
- `urban-ai-backend-main/src/entities/user.entity.ts`
  - Tabela default `user`, primary key UUID string.
- `urban-ai-backend-main/src/migrations/1745800000000-CatchupFeatureEntities.ts`
  - Usa `propriedade_id`/`list_id` como `int` em tabelas como `stays_listings`, `price_snapshots`, `occupancy_history`, `event_proximity_features`.
  - Tenta referenciar tabelas `lists` e `users`.
- As entities atuais referenciam `List`/`User` com UUID.

**Risco:** ambiente criado por migrations pode divergir do ambiente criado por `synchronize`. Isso afeta Stays, dataset, occupancy e features de eventos, justamente areas novas e operacionais.

**Recomendacao inicial:**

- Corrigir migrations para `varchar(36)` em IDs relacionados a UUID.
- Usar nomes reais de tabela (`list`, `user`) ou padronizar entities/migrations.
- Rodar validação em banco temporario comparando schema gerado por migrations vs metadata TypeORM.

### P1-030 - Migration `AddPricingColumnsToPlans` nao e idempotente

**Evidencia:**

- `urban-ai-backend-main/src/migrations/1778015000000-AddPricingColumnsToPlans.ts`
  - Faz `ALTER TABLE plans ADD ...` direto, sem checar se as colunas ja existem.
- Outras migrations recentes foram escritas de modo idempotente para ambientes que ja passaram por `synchronize`.

**Risco:** em ambiente onde `plans` ja tem colunas F6.5 por `synchronize` ou apply manual, `MIGRATIONS_RUN=true` pode falhar no boot.

**Recomendacao inicial:**

- Tornar a migration idempotente com inspeção de tabela antes de cada `ADD`.
- Antes de ligar `MIGRATIONS_RUN=true` em prod, executar `migration:show`/dry-run contra clone do banco real.

### P2-001 - Lockfiles e package managers estao misturados entre CI e Docker

**Evidencia:**

- `urban-ai-backend-main/` contem `package-lock.json`, `yarn.lock` e `pnpm-lock.yaml`.
- `Urban-front-main/` contem `package-lock.json` e `yarn.lock`.
- `.github/workflows/ci.yml` instala com `yarn install --frozen-lockfile`.
- Dockerfiles de backend e frontend usam `npm ci`.

**Risco:** CI pode validar uma arvore de dependencias diferente da imagem de producao, especialmente em upgrades de pacote/transitives.

**Recomendacao inicial:**

- Escolher um package manager oficial por app.
- Remover lockfiles nao oficiais.
- Alinhar CI, Docker e README no mesmo comando.

### P2-002 - Guardas frontend sao inconsistentes entre rotas

**Evidencia:**

- Algumas rotas usam `PaymentCheckGuard` (`dashboard`, `properties`, `maps`, `painel`).
- Outras usam apenas `SideBar`, que checa token no client e redireciona.
- Rotas admin parecem depender da protecao do backend, nao de um layout/guard frontend central.

**Risco:** UX inconsistente, flicker de tela protegida, comportamento diferente entre paginas e manutencao dificil.

**Recomendacao inicial:**

- Criar uma camada unica de protecao de rotas baseada em sessao validada no backend.
- Para admin, adicionar guard visual e tratar 403 de forma explicita.
- Manter o backend como fonte de verdade, mas evitar renderizar paginas privadas quando a sessao e desconhecida.

### P2-003 - Host routing esta implementado, mas depende de dominio final confirmado

**Evidencia:**

- `Urban-front-main/src/middleware.ts` separa `myurbanai.com` e `app.myurbanai.com`.
- O README/docs tambem citam `urban.ai`, `api.urban.ai`, `urbanai.com.br` em pontos diferentes.

**Risco:** confusao operacional em DNS, cookies (`COOKIE_DOMAIN`) e URLs de Stripe/reset/landing.

**Recomendacao inicial:**

- Definir oficialmente matriz de dominios: marketing, app, API, assets, e-mail.
- Alinhar `COOKIE_DOMAIN`, `FRONT_BASE_URL`, `MARKETING_BASE_URL`, `SUCCESS_URL`, `RESET_PASS_URL`.

### P2-004 - `api.ts` do frontend mistura contratos antigos e atuais

**Evidencia:**

- `Urban-front-main/src/app/service/api.ts` referencia endpoints que nao aparecem nos controllers atuais:
  - `GET /auth/verify-email`
  - `POST /auth/request-password-reset`
  - `POST /auth/reset-password`
  - `POST /email/send-verify`
  - `GET /connect/user-managed-listings-with-cep/:userId`
  - `POST /propriedades/createOrUpdatePercentual`
- Ao mesmo tempo, as telas reais de reset/confirmacao usam endpoints legados em `/email/*`.

**Risco:** partes da UI ou futuras alteracoes podem chamar funcoes aparentemente prontas, mas quebrar em runtime. Tambem confunde a migracao para reset por token.

**Recomendacao inicial:**

- Gerar um inventario "frontend function -> backend route".
- Remover funcoes mortas ou criar os endpoints corretos com testes.
- Considerar OpenAPI/typed client para reduzir drift.

### P2-005 - NextAuth/Google esta parcialmente configurado, mas parece desconectado da UI principal

**Evidencia:**

- `Urban-front-main/src/app/api/auth/[...nextauth]/route.ts` configura GoogleProvider e paginas `signIn: "/login"`.
- Nao existe rota `Urban-front-main/src/app/login/page.tsx`; a tela de login real e `/`.
- `AuthContext` tenta aproveitar `session.accessToken`, mas o fluxo principal faz login direto em `/auth/login` e grava `localStorage`.

**Risco:** tentativa de ativar Google OAuth pode cair em 404 ou sessao incompleta. A existencia de dois sistemas de auth no front aumenta o risco da migracao cookie/localStorage.

**Recomendacao inicial:**

- Decidir se NextAuth continua ou sera removido.
- Se continuar, criar `/login` ou apontar para `/`, configurar callbacks para trocar Google token por token/cookie do backend e cobrir com smoke test.

---

## 5. Pontos Fortes Ja Confirmados

- Backend tem testes reais em dominios criticos: auth, payments, plans, stays, eventos, pricing/KNN.
- `JWT_SECRET` e fail-fast no backend.
- `DB_SYNCHRONIZE` e `MIGRATIONS_RUN` sao controlados por env.
- Existem migrations TypeORM versionadas.
- Admin routes principais usam `JwtAuthGuard + RolesGuard('admin')`.
- `EventsIngestController` e `CoverageController` estao protegidos por role admin.
- `StaysService` valida ownership via `userId` em account/listing/price update.
- `PaymentsService` trabalha a partir de `req.user.userId` nos endpoints autenticados.
- `EventsIngestService` tem dedup, limite de batch e update conservador.
- CI existe em `.github/workflows/ci.yml`.
- Backup off-site existe em `.github/workflows/backup-db.yml`.
- Webscraping tem boa cobertura local de testes.

---

## 6. Mapa Inicial do Sistema

### Produto

1. Frontend Next.js recebe usuario, onboarding, painel, planos, admin, waitlist.
2. Backend NestJS centraliza auth, usuarios, propriedades, eventos, pricing, pagamentos, Stays e admin.
3. Eventos chegam por scraping/API/curadoria em `POST /events/ingest`.
4. Backend enriquece/geocodifica eventos, filtra cobertura e calcula relevancia.
5. Motor de pricing usa estrategia configuravel (`rules`, `xgboost`, `shadow`, `auto`) com fallback para regras.
6. Stays permite modo automatico/futuro de push de preco com guardrails.
7. Stripe gerencia assinatura e quota por imovel.

### Operacao Interna

- `_opensquad/` e `squads/` sao automacao interna para auditoria, marketing, roadmap e analises.
- Nao fazem parte do runtime do produto.

### Superficie HTTP - leitura inicial

**Publico por design ou aceitavel:**

- `GET /health`, `GET /health/live`, `GET /public-config`
- `POST /waitlist`, `GET /waitlist/me`, `GET /waitlist/invite` com throttling especifico
- `GET /plans`
- `POST /payments/webhook` desde que assinatura Stripe seja validada
- `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`, `POST /auth/logout`

**Autenticado e geralmente correto:**

- `/payments/*` exceto webhook
- `/stays/*`
- `/auth/me`, `/auth/profile`, `/users/me/has-address`
- `/connect/register`, `/connect/user-addresses`, `/connect/addresses`
- Partes de `/propriedades/*` que usam `req.user.userId`
- `/maps/processar-analises-by-property*`
- `/admin/*`, `/admin/coverage/*`, `/events/*` de ingest/import/geocoder com `RolesGuard('admin')`

**Publico suspeito/legado, precisa classificacao:**

- `/auth/:id`, `/auth/:id/update`
- `/email/*` de reset/profile/notificacao
- `/maps/*` batch/manual, `/cron/*`, `/processos/pricing`, `/process-status`
- `/dashboard` legado por `usuarioId`
- `/propriedades/*` que recebe `usuarioId`, `propriedadeId` ou `propertyId` sem auth
- `/airbnb/*` e consultas RapidAPI via `/propriedades/airbnb/*`
- `/notifications/:userId`, `/notifications/:id/opened`
- `/sugestoes-preco/:id/aceito`
- `/mailer/send`

---

## 7. Perguntas em Aberto

- Quais endpoints legados ainda sao usados pelo frontend atual?
- O ambiente de producao esta com `DB_SYNCHRONIZE=false` de fato?
- `PRELAUNCH_MODE` esta ativo em producao ou o app ja permite cadastro real?
- O dump SQL contem dados pessoais reais?
- Stays esta em producao real ou somente fundacao/mock/sandbox?
- Qual e a URL oficial atual: `myurbanai.com`, `app.myurbanai.com`, `urban.ai`, `urbanai.com.br`?
- Stripe esta em test mode ou live com KYC completo?
- Existe staging operacional configurado no Railway?

---

## 8. Proximas Frentes de Revisao

1. Auditar backend por dominio e por ownership de dados.
2. Mapear todos os endpoints publicos e classificar como publico/autenticado/admin/interno.
3. Validar fluxos frontend: login, waitlist, onboarding, checkout, cadastro de imovel, dashboard.
4. Revisar estrategia de pricing/ML: o que e real, o que e scaffold, o que e mock.
5. Revisar pipeline e scraping: fontes, schedules, ingestao, resiliencia e riscos juridicos.
6. Consolidar runbook de assuncao operacional: acessos, secrets, deploy, rollback, incidentes.

---

## 9. Execucao Complementar - 2026-05-13

### Stays

- `stays_accounts.accessToken` passou a usar transformer AES-256-GCM com prefixo `enc:v1:`.
- `STAYS_TOKEN_ENCRYPTION_KEY` e obrigatoria para persistir tokens em `APP_ENV`/`NODE_ENV` `staging` ou `production`.
- Tokens legados em plaintext continuam legiveis; ao serem salvos novamente com chave configurada, passam a ser criptografados.
- Migration `1778200000000-ExpandStaysAccessTokenForEncryption` aumenta a coluna para 2048 caracteres.

### Frontend

- Inicio da limpeza de contratos legados de auth/reset no cliente: removidas chamadas exportadas para `/auth/verify-email` e `/email/send-verify`, que nao fazem parte do contrato atual validado.

### Hardening adicional

- Endpoints legados de dashboard por `usuarioId` agora exigem JWT e bloqueiam acesso cruzado.
- Endpoints HTTP de Airbnb, `process-status`, `connect` de scraping/preco/resolve e consultas caras de `propriedades` agora exigem autenticacao; `airbnb/*` e `process-status` ficaram restritos a admin.
- Chamadas internas continuam por service injection, sem depender das rotas HTTP publicas.
- Frontend deixou de chamar a rota inexistente `/connect/user-managed-listings-with-cep/:id` no fluxo de verificacao de endereco.

### CI

- `.github/workflows/ci.yml` agora inclui `urban-webscraping-main` com `uv run pytest -q`.
- `.github/workflows/ci.yml` agora inclui `urban-pipeline-main` com `uv run pytest tests -q`.
- Pipeline corrigido para suportar URL SQLite nos E2E, expor Secret mockavel, listar `CommonPrefixes` do S3 e completar helpers de teste.

### Configuracao e Secrets

- Removido fallback inseguro `JWT_SECRET || 'defaultSecret'` do `UserModule`; o `UserService` nao usava `JwtService`, entao a dependencia foi eliminada.
- `instrument.ts` deixou de carregar DSN Sentry hardcoded. Sentry agora so inicializa quando `SENTRY_DSN` estiver configurado no ambiente.
- `data-source.ts` da CLI TypeORM ficou explicitamente com `synchronize: false` e `migrationsRun: false`, reduzindo risco de execucao acidental fora do fluxo controlado pelo app/deploy.
- Criada matriz operacional de variaveis em `docs/runbooks/matriz-env-operacional.md`.
- `.env.example` de backend, frontend, pipeline e webscraping atualizados para refletir variaveis realmente lidas pelo codigo.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.

### Migrations e Schema

- `AddPricingColumnsToPlans1778015000000` ficou idempotente: adiciona/dropa colunas apenas se elas existem/nao existem. Isso reduz risco de falha no boot quando `plans` ja recebeu colunas via `synchronize`.
- `CatchupFeatureEntities1745800000000` agora cria colunas relacionais como UUID (`varchar(36)`) e referencia as tabelas reais `user` e `list`, alinhando com as entities atuais.
- Criada migration `1778300000000-AlignFeatureForeignKeysWithUuid` para corrigir ambientes onde a catch-up antiga ja tenha rodado com `int`/FKs antigas. Ela alinha colunas relacionais de `stays_listings`, `price_snapshots`, `occupancy_history` e `event_proximity_features`, e recria FKs para as tabelas corretas quando existirem.
- O achado P1-028 permanece parcialmente aberto: a baseline inicial ainda e vazia, entao banco realmente fresh continua exigindo baseline real ou restore de backup completo. O que foi mitigado agora sao as divergencias das migrations pos-baseline.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.

### Backup e Restore

- `.github/workflows/backup-db.yml` deixou de parsear `DATABASE_URL` com cortes shell frageis e passou a usar `urllib.parse`, com `unquote` para usuario/senha/nome do banco. Isso cobre senhas com caracteres especiais/URL encoded.
- `SLACK_BACKUP_WEBHOOK` agora e exposto como env do job (`SLACK_WEBHOOK`), entao as condicoes de sucesso/falha conseguem avaliar corretamente se ha webhook configurado.
- `mysqldump` agora inclui `--events`, alinhando o workflow com o runbook manual.
- Validacao local limitada: nao ha parser YAML (`PyYAML`) disponivel no runtime local; a revisao foi estrutural/manual. Confirmar no GitHub Actions com `workflow_dispatch` antes de depender do alerta.

### Swagger / Superficie de Descoberta

- `/api` Swagger deixou de ficar sempre ativo. O backend agora habilita Swagger por padrao em dev/staging e desabilita em `APP_ENV=production`, salvo override explicito `ENABLE_SWAGGER=true`.
- `urban-ai-backend-main/.env.example` documenta `ENABLE_SWAGGER=false` para producao.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.

### Logs e PII

- Removidos logs diretos de `req.user`, payload de checkout, payloads de propriedades/enderecos, variaveis de template de e-mail e dumps de respostas Airbnb.
- `MailerService` agora usa `Logger` e mascara e-mails nos logs, registrando chaves de variaveis em vez de valores completos.
- `MailerController` deixou de retornar o e-mail completo na mensagem de sucesso.
- `DashboardService` deixou de logar valores financeiros e objetos de analise.
- Logs de cron/e-mail passaram a usar `userId` ou e-mail mascarado em pontos sensiveis, em vez de e-mail completo/nome.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.

### Jobs Internos vs HTTP Admin

- `ProcessosConsumer` nao possui mais fallback legado que chamava `/maps/processar-analises` via HTTP interno. O worker usa `MapsService` diretamente.
- `MapsController` foi simplificado: removeu endpoint morto `processar-analises-by-property-teste`, removeu IDs hardcoded e deixou de usar `@Res()` manual em rotas de processamento.
- Rotas manuais de geocoding agora aguardam o service e retornam o resultado real, em vez de responder "iniciado" enquanto o trabalho roda solto.
- O processamento por propriedade nao dispara mais geocoding global de todos os enderecos e eventos; ele tenta completar lat/lng somente dos enderecos da propriedade alvo. Geocoding de eventos continua sendo batch/admin/scheduler separado.
- `ProcessoController` removeu `console.log` direto e padronizou enfileiramento com `Logger`.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.

### Status, Locks e Idempotencia de Jobs

- `ProcessService.ensureExists()` agora inicializa o status global como `completed`, nao `running`. Isso evita que um boot limpo pareca processamento em andamento sem haver job ativo.
- O default de schema de `process_status.status` tambem foi alinhado para `completed`.
- O default de schema de `addresses.analisado` foi alinhado para `pending`. Propriedade nova agora nasce como aguardando processamento, e so vira `running` quando o job efetivamente inicia.
- Criada migration `1778400000000-AlignOperationalStatusDefaults` para alinhar os defaults operacionais sem alterar em massa linhas existentes.
- `ProcessService.tryMarkRunning()` adiciona uma trava transacional com `pessimistic_write` para o processamento global de mapas. Se ja houver status `running` recente, a rotina retorna sem iniciar outro batch.
- A trava global considera um status `running` com mais de 2 horas como stale e permite uma nova execucao. Esse limite e uma protecao operacional contra status preso apos crash.
- `MapsService.processarAnalisesTodosUsuarios()` usa a trava global antes de executar o batch e retorna `ok: false` quando ja existe processamento em andamento.
- `MapsService.processarAnalisesByProperty()` deixou de atualizar o status global para jobs por propriedade. O estado desse fluxo passa a ficar no campo `addresses.analisado` da propriedade alvo (`pending`, `running`, `completed`, `error`).
- A geocodificacao pontual e a busca de enderecos para analise por propriedade agora filtram por `listId` e `userId`, reduzindo risco de tocar enderecos de outro dono em caso de ID conhecido/reutilizado.
- `POST /processos` passou a usar `jobId` deterministico por usuario/propriedade (`processo-{userId}-{propertyAdressId}`). Jobs em `waiting`, `active`, `delayed` ou `paused` sao ignorados; jobs `completed` ou `failed` antigos sao removidos antes de reenfileirar.
- `POST /processos` agora valida que os `listIds` pertencem ao usuario autenticado antes de enfileirar. IDs sem ownership sao ignorados e contabilizados como `propriedadesIgnoradas`.
- `POST /processos/pricing` recebeu a mesma protecao idempotente com `jobId` deterministico (`processar-pricing-{userId}-{propertyAdressId}`).
- `POST /processos/pricing` agora valida que a propriedade pertence ao `userId` informado antes de criar job admin.
- O onboarding e o modal de adicionar imovel passaram a enfileirar `/processos` logo apos criar os enderecos. Antes, propriedades podiam nascer em estado aguardando sem nenhum worker programado.
- O dashboard passou a reconhecer qualquer transicao para `completed` (`pending -> completed`, `running -> completed` ou `error -> completed`), nao apenas `running -> completed`.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.
- Frontend `tsc --noEmit`: passou.
- Frontend `next build`: passou com warnings preexistentes de lint/lockfiles/i18n.

### Quota de Imoveis e Criacao Parcial

- `POST /connect/register` agora valida quota antes de salvar `List`, contando apenas propriedades que ainda nao possuem `Address` para o usuario. Isso evita criar imovel parcial quando a quota barraria a etapa seguinte.
- `POST /connect/addresses` tambem passou a contar apenas novos slots reais. Reenviar endereco de uma propriedade ja cadastrada atualiza o registro existente, sem consumir quota duplicada.
- `ConnectService.createMultipleAddresses()` agora falha se o `list.id` informado nao pertence ao usuario e atualiza `Address` existente por usuario/propriedade, em vez de criar duplicata.
- Onboarding e modal de adicionar imovel exibem a mensagem especifica `LISTINGS_QUOTA_EXCEEDED` quando a quota barra o cadastro.

Validacao desta leva:

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.
- Frontend `tsc --noEmit`: passou.
- Frontend `next build`: passou com warnings preexistentes de lint/lockfiles/i18n.

### Limpeza do Fluxo Legado de Verificacao de Endereco

- `/address-verification` nao possui mais fluxo proprio legado; a rota ficou como redirect de compatibilidade para `/onboarding`.
- O fluxo canonico de cadastro de imovel agora e `/onboarding` para primeira configuracao e o modal em `/properties` para inclusoes posteriores.
- O onboarding deixou de depender de `localStorage.registeredProperties` para iniciar analises. Depois de criar os enderecos, ele enfileira `/processos` diretamente com os IDs retornados por `/connect/register`.
- Foram removidos exports mortos do cliente para `getUserAddresses`, `registerAddresses` e `processAnalysesByProperty`, que sustentavam o fluxo antigo.
- Foram removidos tipos sem uso do frontend (`ConnectWithCep`, `CepValidation`, `AddressData`) ligados a uma tentativa antiga de validar CEP fora do fluxo atual.
- O frontend passou a usar a rota canonica `POST /connect/addresses` para criar enderecos. O backend ainda preserva aliases `create-addresses` e `create-multiple-addresses` para compatibilidade.
- Removido o endpoint morto `GET /connect/created`, que recebia body em GET e nao tinha uso no frontend atual.
- Removidos wrappers mortos de reset/teste no `api.ts` (`requestPasswordReset`, `resetPassword`, `teste`), mantendo os wrappers realmente usados: `forgotPassword` e `updatePassword`.

Validacao desta leva:

- Frontend `tsc --noEmit`: passou.
- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- Backend Jest: 144/144 testes passaram.
- Frontend `next build`: passou com warnings preexistentes de lint/lockfiles/i18n/Sentry.

### Higiene de Build Frontend

- Removidos imports, estados e argumentos sem uso em paginas/componentes do frontend (`header`, `SideBar`, `Pagination`, `create`, `confirm-email`, `reset-password`, `event-log`, `near-events`, `admin/users`, `painel`, `dashboard`, `maps`, `onboarding`, `properties`).
- Corrigido bug potencial em `/near-events/[id]`: o card da propriedade so renderiza quando `endereco` existe, evitando acesso a `endereco.id` antes do carregamento terminar.
- Trocas de pagina/listagem passaram a usar callbacks estaveis onde havia warnings de `react-hooks/exhaustive-deps`.
- `/maps` deixou de calcular variaveis de preco/data nao usadas antes de renderizar `EventCard`.
- `instrumentation-client.ts` passou a exportar `onRouterTransitionStart`, removendo a acao requerida pelo Sentry durante o build.
- Fontes Google sairam de `<head>` manual em `layout.tsx`; `Bebas Neue` foi adicionada ao import global de CSS.
- `next.config.ts` agora define `outputFileTracingRoot: process.cwd()`, removendo a inferencia incorreta causada por multiplos lockfiles no workspace.
- `Providers` inicializa `../../i18n` uma vez no topo da arvore client, removendo o warning de `react-i18next` durante geracao estatica.
- `next build` exigiu limpar o cache gerado `.next/cache` por falta temporaria de espaco (`ENOSPC`). O cache foi removido apos validar que o caminho estava dentro de `Urban-front-main`.

Validacao desta leva:

- Frontend `tsc --noEmit`: passou.
- Frontend `next build`: passou sem warnings de ESLint, Sentry, fonte customizada, root inference ou i18next. Permanece apenas aviso ambiental de cache webpack: `Unable to snapshot resolve dependencies`.

### Auditoria Railway e MCP

- Railway CLI oficial instalado em `C:\tmp\railway-cli\railway.exe`, versao `4.58.0`, com login validado para `urbanai.admin@gmail.com`.
- Railway MCP configurado no Codex em `C:\Users\gusta\.codex\config.toml`. A sessao atual pode precisar reiniciar o Codex para expor as ferramentas MCP diretamente; ate la, a operacao fica disponivel pela CLI autenticada.
- Workspace Railway acessado: `urbanai-tech's Projects`.
- Projetos em producao encontrados: `Front`, `backend`, `mysql`, `KnnEngine`, `urban-pipeline`, `webscrapping`.
- Todos os servicos Railway listados estao com deployment atual `SUCCESS`, `deploymentStopped=false` e 1 replica rodando em `us-west2`.
- `Front` aponta para `https://app.myurbanai.com`; check externo via `curl -I` retornou `200 OK` e headers de Next.js/Railway/Cloudflare.
- `backend` aponta para `https://urbanai-production-85fd.up.railway.app`; `GET /health` retornou `200 OK` com `checks.db=ok`, e `GET /health/live` retornou `200 OK`.
- `mysql` usa imagem `mysql:9.4`, volume `mysql-volume` montado em `/var/lib/mysql`, estado `READY`, tamanho configurado 500 MB. Observacao: o Railway reportou `currentSizeMb=0.0`, valor que merece confirmacao por backup/dump ou painel, pois pode ser metrica incompleta.
- `KnnEngine` e `webscrapping` retornam `401 Unauthorized` no root publico, coerente com APIs protegidas, mas geram ruido de HTTP 401 em probes/HEAD. Recomendado criar endpoints publicos simples de health (`/health` sem segredo) ou ajustar monitoramento para rotas autenticadas esperadas.
- `urban-pipeline` retorna `502 Bad Gateway` no dominio publico Railway, embora o deployment esteja `SUCCESS`. Isso parece consistente com worker/Prefect runner sem servidor HTTP, mas o dominio publico deveria ser removido/desabilitado ou substituido por health endpoint real para evitar falso incidente e superficie desnecessaria.
- Logs recentes do frontend mostram erros Next.js `Failed to find Server Action`, tipicamente causados por clientes com bundle antigo fazendo submit apos troca de deployment. Nao parece queda atual, mas recomenda-se reduzir uso de Server Actions em fluxos criticos ou tratar retry/refresh quando action hash expirar.
- Logs HTTP recentes do frontend mostram 404 para caminhos como `/"_next/static/chunks/...`, com aspas no path. Isso sugere cliente, crawler, HTML antigo ou algum link malformado tentando buscar chunks com aspas. Monitorar se persiste apos proximo deploy; se persistir, procurar origem no HTML servido/cache/CDN.
- Logs recentes do `backend` incluem blocos `Unauthenticated`/`401`. Como o HTTP log publico nao mostrou 5xx, isso parece ruido de autenticacao esperada, mas precisa de filtro de observabilidade para separar erro real de acesso anonimo.
- Logs do `urban-pipeline` aparecem como DEBUG do Prefect (`Discovered 0 scheduled_flow_runs`), classificados pela coleta como erro por causa do filtro de nivel/log format. Nao ha evidencia de falha operacional nessa amostra.
- Inventario de variaveis foi coletado apenas por nomes de chaves; valores nao foram registrados no relatorio. A lista confirma presenca de segredos de Stripe, Google, MailerSend, JWT, banco, Prefect, AWS e APIs internas. Proximo passo seguro: conferir rotacao/proprietario de cada segredo sem colar valores em docs.

Validacao desta leva:

- `railway whoami`: passou como `urbanai.admin@gmail.com`.
- `railway list --json`: passou e retornou 6 projetos.
- `railway service list/status`: passou para os 6 projetos.
- `railway deployment list --limit 8`: passou para os servicos avaliados; amostra mostrou deployments atuais `SUCCESS`.
- Checks externos via `curl`: frontend `200`, backend `/health` `200`, backend `/health/live` `200`, KNN root `401`, webscrapping root `401`, pipeline root `502`.

### Refresh Railway Pos-Reinicio do Codex

- O Railway MCP ainda nao apareceu na sessao apos o primeiro reinicio porque o `config.toml` gerado pela CLI apontava para `command = "railway"`, mas a CLI local nao esta no PATH.
- Ajustado `C:\Users\gusta\.codex\config.toml` para usar caminho absoluto: `command = 'C:\tmp\railway-cli\railway.exe'`.
- Backup do config anterior salvo em `C:\tmp\codex-config-before-railway-absolute-path.toml`.
- Observacao: sera necessario reiniciar o Codex mais uma vez para o processo carregar o MCP Railway com o caminho corrigido. Enquanto isso, a CLI autenticada segue funcional.
- Nova coleta Railway completa salva localmente em `C:\tmp\railway-audit-2026-05-13-refresh\railway-report-sanitized.json` com inventario sem valores de segredo.

Achados atualizados:

- `webscrapping`: deployment atual `SUCCESS`, 1/1 replica, HTTP `>=400` dominado por `HEAD / -> 401`. Sem 5xx recentes. Historico recente tem 4 deploys falhos; log relevante antigo apontou `bash: /scripts/run_all_collectors.sh: No such file or directory`, depois corrigido pelo deployment atual.
- `urban-pipeline`: deployment atual `SUCCESS`, 1/1 replica, mas dominio publico retorna `502` com `Retried single replica`. Como os logs mostram runner Prefect consultando schedules, o servico aparenta ser worker sem HTTP server. Remover dominio publico ou criar health endpoint real.
- `KnnEngine`: deployment atual `SUCCESS`, 1/1 replica, HTTP `>=400` dominado por `HEAD / -> 401`. Sem 5xx e sem app errors recentes na amostra.
- `mysql`: deployment atual `SUCCESS`, 1/1 replica, volume `mysql-volume` em `/var/lib/mysql`, estado `READY`, tamanho configurado 500 MB.
- `backend`: deployment atual `SUCCESS`, 1/1 replica, sem 5xx HTTP recentes na amostra, mas com app errors reais.
- `Front`: deployment atual `SUCCESS`, 1/1 replica, sem HTTP `>=400` recentes na amostra, mas ainda ha erros Next.js antigos de Server Action expirada em 2026-05-06.

Achado critico de backend:

- Log de 2026-05-13 11:00 UTC: `Erro no envio diario de notificacoes: QueryFailedError: Unknown column 'AnalisePreco.preco_aplicado' in 'field list'`.
- Causa provavel: entity `AnalisePreco` possui `preco_aplicado`, `aplicado_em` e `origem_aplicacao`, mas nao havia migration criando essas colunas em `analise_preco`.
- Producao nao possui variaveis `DB_SYNCHRONIZE` nem `MIGRATIONS_RUN` configuradas no backend, entao schema drift nao e autocorrigido no boot.
- Criada migration idempotente `1778500000000-AddAnalisePrecoApplicationFields` para adicionar `preco_aplicado`, `aplicado_em` e `origem_aplicacao` se a tabela existir e as colunas ainda faltarem.

Validacao desta leva:

- Backend `tsc --noEmit`: passou usando Node local do Codex.
- Backend `nest build`: passou usando Node local do Codex.
