# Runbook de Assuncao Operacional - Urban AI

Data: 2026-05-13

Este runbook define o minimo para operar o Urban AI com seguranca apos as primeiras correcoes de autenticacao, ownership e reset de senha.

## 1. Antes de Qualquer Deploy

- Confirmar branch, commit e diff exato a ser promovido.
- Rodar validacoes locais:
  - Backend: `tsc --noEmit`
  - Backend: Jest completo
  - Frontend: `tsc --noEmit`
- Confirmar que nao ha `.env`, dumps SQL ou chaves reais no diff.
- Confirmar que migrations novas foram revisadas e tem rollback.
- Confirmar variaveis obrigatorias no ambiente alvo usando `docs/runbooks/matriz-env-operacional.md`.
- Confirmar CI verde para backend, frontend, webscraping e pipeline.

## 2. Secrets e Variaveis

Manter secrets fora do repo. Configurar por ambiente:

Referencia detalhada: `docs/runbooks/matriz-env-operacional.md`.

- Backend auth: `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_DOMAIN`, `APP_ENV`
- Swagger/API docs: `ENABLE_SWAGGER=false` em producao, habilitar apenas sob demanda
- URLs: `FRONT_BASE_URL`, `MARKETING_BASE_URL`, `RESET_PASS_URL`
- Banco: `DATABASE_URL` ou host/user/pass/db equivalentes
- E-mail: `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs
- Google/Maps: chave de geocoding/maps quando aplicavel
- Sentry: DSN e auth token apenas em CI/operacao
- Stays: credenciais por usuario via UI; `STAYS_TOKEN_ENCRYPTION_KEY` obrigatoria em staging/producao para criptografar tokens em repouso

## 3. Deploy Backend

1. Promover imagem/build para staging.
2. Executar migrations em staging.
3. Rodar smoke tests de API.
4. Validar logs de boot:
   - sem erro de `JWT_SECRET`
   - sem falha TypeORM/migrations
   - sem erro de DI Nest
5. Promover para producao.
6. Monitorar logs, Sentry e Stripe webhooks por pelo menos 30 minutos.

### Jobs de mapas/pricing

- Jobs de pricing devem entrar pela fila `processos`; o worker chama `MapsService` diretamente, sem HTTP interno.
- Jobs por propriedade usam `jobId` deterministico por usuario/propriedade. Se ja houver job `waiting`, `active`, `delayed` ou `paused`, a nova solicitacao deve ser tratada como duplicada e ignorada.
- Jobs antigos em `completed` ou `failed` podem ser removidos e reenfileirados pela propria rota, permitindo reprocessamento explicito sem criar duplicidade.
- `/processos` deve receber IDs de `list` pertencentes ao usuario autenticado. IDs de outro usuario nao devem gerar job e aparecem como `propriedadesIgnoradas`.
- O processamento global de mapas usa trava em `process_status`. Se o status estiver `running` ha menos de 2 horas, nao iniciar outro batch global.
- Se `process_status` ficar `running` por mais de 2 horas, tratar como possivel job preso: conferir logs/worker/Bull/Redis antes de disparar novo batch. A aplicacao permite nova execucao por considerar o status stale.
- Jobs por propriedade nao devem alterar `process_status`; acompanhar o estado pelo campo `addresses.analisado` da propriedade alvo.
- Interpretacao de `addresses.analisado`: `pending` = aguardando fila/worker; `running` = worker iniciou; `completed` = analise concluida; `error` = falha controlada.
- Onboarding e modal de adicionar imovel devem criar endereco e enfileirar `/processos` na mesma jornada. Se uma propriedade ficar muito tempo em `pending`, verificar se o enqueue falhou, se Redis/Bull esta disponivel e se ha worker ativo.
- Geocoding de eventos e enderecos globais deve ser acionado por rota admin/scheduler proprio, nao como efeito colateral de um job por propriedade.
- Antes de processar uma propriedade, confirmar que o endereco alvo tem lat/lng ou deixar o job completar apenas aquele endereco.
- Evitar rodar `/maps/processar-analises` global em horario comercial; preferir janela operacional e monitoramento de custo Google Maps/RapidAPI.

## 4. Deploy Frontend

1. Validar `NEXT_PUBLIC_API_URL` apontando para API correta.
2. Confirmar que requests usam `withCredentials`.
3. Subir staging.
4. Rodar smoke tests de login, reset, checkout e dashboard.
5. Promover para producao.

### Fluxo de onboarding

- `/onboarding` e o fluxo canonico para primeira configuracao de imoveis.
- `/properties` com modal de adicionar imovel e o fluxo canonico para inclusoes apos o onboarding.
- `/address-verification` existe apenas como rota de compatibilidade e deve redirecionar para `/onboarding`.
- Onboarding e modal devem criar `Address` e enfileirar `/processos` sem depender de `localStorage.registeredProperties`.

### Quota de imoveis

- A quota e medida por `Address` ativo do usuario, nao apenas por `List`.
- `/connect/register` e `/connect/addresses` devem barrar novos slots acima da quota antes de criar dados parciais.
- Reenvio do mesmo imovel/endereco deve ser idempotente: atualizar o `Address` existente, sem aumentar `ativos`.
- Em erro `LISTINGS_QUOTA_EXCEEDED`, orientar o usuario a aumentar a quantidade no plano antes de tentar adicionar novos imoveis.

## 5. Migrations

Para a leva atual, a migration critica e:

- `1778100000000-CreatePasswordResetTokens`
- `1778200000000-ExpandStaysAccessTokenForEncryption`
- `1778300000000-AlignFeatureForeignKeysWithUuid`
- `1778400000000-AlignOperationalStatusDefaults`

Checklist:

- Rodar em staging primeiro.
- Confirmar existencia de `password_reset_tokens`.
- Confirmar indices de `tokenHash` e `user_id/usedAt`.
- Confirmar FK para `user`.
- Testar reset de senha completo apos migration.
- Confirmar que `stays_accounts.accessToken` suporta tokens criptografados de ate 2048 caracteres.
- Confirmar que colunas relacionais novas usam UUID/varchar(36): `stays_listings.propriedade_id`, `price_snapshots.list_id`, `price_snapshots.address_id`, `occupancy_history.list_id`, `occupancy_history.address_id`, `event_proximity_features.list_id`, `event_proximity_features.address_id`.
- Confirmar FKs para tabelas reais `user`, `list` e `addresses` em clone/staging antes de ligar `MIGRATIONS_RUN=true` em producao.
- Confirmar defaults operacionais: `addresses.analisado` = `pending` e `process_status.status` = `completed`.

Observacao operacional: a baseline historica ainda e vazia. Para disaster recovery, o caminho confiavel continua sendo restore de backup completo + migrations posteriores. Banco fresh 100% por migrations ainda exige uma baseline real do schema atual.

## 6. Rollback

Rollback de aplicacao:

- Reverter para build anterior do backend/front.
- Manter migration de reset se ja aplicada; ela e aditiva e nao quebra o build anterior.

Rollback de banco:

- So executar `down` se houver certeza de que nenhum reset em andamento precisa ser preservado.
- Preferir pausar o endpoint/feature e investigar antes de remover tabela.

## 7. Incidentes

Incidente de auth:

- Pausar deploys.
- Rotacionar `JWT_SECRET` se houver suspeita de vazamento.
- Revogar refresh tokens no banco quando necessario.
- Invalidar cookies via deploy com segredo novo.

Incidente de e-mail/reset:

- Pausar envio de reset se tokens forem expostos.
- Invalidar tokens pendentes marcando `usedAt`.
- Rotacionar `BREVO_API_KEY` se necessario.

Incidente Stripe:

- Validar assinatura webhook.
- Conferir duplicidade/idempotencia de eventos.
- Comparar estado Stripe vs `payments`/assinatura local.

Incidente Stays:

- Desconectar conta afetada.
- Zerar token local.
- Pausar pushes automaticos.
- Fazer rollback de preco via endpoint Stays quando houver registro `PriceUpdate` bem-sucedido.

Incidente de logs/PII:

- Pausar exportacao/compartilhamento de logs afetados.
- Identificar janela temporal e campos expostos.
- Rotacionar secrets/tokens se algum valor sensivel apareceu em log.
- Remover amostras locais e abrir postmortem com escopo de dados expostos.

## 8. Criterios Para Operar Com Usuarios Reais

- Todos P0 fechados.
- P1 de auth/ownership tratados ou aceitos formalmente.
- Reset de senha validado em staging/producao.
- Stripe em modo correto e webhook assinado.
- Backups com alerta validado.
- Smoke tests documentados executados no deploy.
