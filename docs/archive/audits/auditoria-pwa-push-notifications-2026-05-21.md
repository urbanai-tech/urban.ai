# Auditoria PWA Push Notifications - 2026-05-21

> SUPERSEDED: auditoria histórica. Consulte `../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`.

Atualizacao 2026-05-22: o veredito inicial abaixo ficou historico. A camada Web Push
foi implementada no runtime depois da primeira leitura, com service worker, opt-in no
frontend, endpoints backend e dispatcher. O canal ainda depende de `WEB_PUSH_PUBLIC_KEY`,
`WEB_PUSH_PRIVATE_KEY` e `WEB_PUSH_SUBJECT` configurados em producao para ser validado
como disponivel fora de smoke.

## Veredito

A Urban AI esta instalavel como PWA, com manifest, icones e service worker de cache/offline, mas ainda nao tem Web Push de verdade.

Hoje os canais reais sao:

- In-app notification: tabela `notifications`, consumida pelo centro de notificacoes.
- Email transacional: MailerService via `EmailService.enviarNotification`, onboarding, senha, billing e relatorios.
- PWA: apenas instalacao/offline. Nao ha assinatura Push API, VAPID, tabela de device subscriptions, listener `push` no `sw.js`, nem listener `notificationclick`.

Conclusao pratica: qualquer coisa enviada por email ainda nao chega como push PWA. Para pushar recomendacoes, precisamos criar a camada de inscricao/disparo e unificar os payloads de notificacao.

## Status De Implementacao

Implementado em 2026-05-21:

- Backend com inscricao Web Push, device secret, entregas pendentes e wake push VAPID sem payload sensivel no provedor de push.
- Frontend com opt-in no centro de notificacoes, assinatura via Push API e sincronizacao segura do device com o service worker.
- Service worker com `push` e `notificationclick`, abrindo deep link dentro do app.
- Dispatcher integrado ao fluxo atual de `EmailService.enviarNotification`, ou seja, notificacoes que ja iam para in-app/email podem tambem virar push PWA.
- Relatorio semanal de eventos tambem dispara resumo push para usuarios ativos com device inscrito.

Ainda depende de configurar `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` e `WEB_PUSH_SUBJECT` no ambiente de producao para o canal sair de `INDISPONIVEL` para `DISPONIVEL`.

## Fontes tecnicas

- MDN `ServiceWorkerRegistration.showNotification`: notificacoes de service worker suportam `body`, `icon`, `badge`, `tag`, `data`, `actions` e resposta via `event.action` no `notificationclick`: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- MDN `push` event: o evento `push` chega ao escopo do service worker quando uma mensagem push e recebida: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event
- MDN `notificationclick`: cliques e botoes de notificacao sao tratados no service worker; a API tem disponibilidade variavel entre browsers: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event
- MDN `PushManager.subscribe`: assinatura deve usar service worker, `userVisibleOnly`, chave VAPID em alguns browsers e deve ser disparada por gesto do usuario: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe

## Estado Atual No Codigo

Frontend:

- `Urban-front-main/public/manifest.webmanifest`: PWA configurada com `display: standalone`, icones, shortcuts e `start_url`.
- `Urban-front-main/public/sw.js`: cache de assets, offline fallback e fetch handling. Nao tem `self.addEventListener("push")`.
- `Urban-front-main/src/app/componentes/PwaInstaller.tsx`: registra `/sw.js` apenas em producao. Nao solicita permissao de notificacao nem chama `pushManager.subscribe`.
- `Urban-front-main/src/app/notificacao/page.tsx`: centro de notificacoes in-app via API.
- `Urban-front-main/src/app/dashboard/components/ItemEvento.tsx`: fluxo de aceitar/cancelar e registrar preco aplicado via API autenticada.

Backend:

- `EmailService.enviarNotification`: cria notificacao in-app e, se `sendEmail=true`, envia email.
- `NotificationsService`: CRUD simples de notificacoes in-app.
- `SugestionService`: endpoints autenticados para aceitar/rejeitar/aplicar recomendacao.
- Nao ha entidade de `PushSubscription`, nem dependencia `web-push`, nem dispatcher por canal.

## Matriz De Canais

| Evento | In-app | Email | PWA push hoje | PWA push recomendado |
|---|---:|---:|---:|---|
| Analise iniciada | sim | sim | nao | opcional, baixa prioridade |
| Sugestoes de preco disponiveis | sim | sim | nao | sim, prioridade alta |
| Cron diario de sugestao aceita | sim/email via cron | sim | nao | sim, mas com deep link |
| Relatorio semanal de eventos | nao | sim | nao | sim, resumo curto |
| Onboarding D+1/D+3/D+7 | nao | sim | nao | nao por padrao; pedir opt-in |
| Reset de senha/codigo | nao | sim | nao | nao, email apenas |
| Billing/quota | email | sim | nao | sim para quota, nao para dados sensiveis |
| Alertas admin/dev | email/log | sim | nao | opcional somente admins |

## Aceitar/Rejeitar Recomendacao

Nao recomendo aceitar ou rejeitar preco diretamente por action button da notificacao PWA nesta fase.

Motivos:

- `notificationclick` e actions variam por plataforma/browser.
- Clique em push nao tem UI rica de confirmacao.
- Service worker pode estar sem contexto completo de autenticacao.
- Aceitar preco e uma mutacao de negocio; precisa de contexto, motivo, preco atual/sugerido e confirmacao visual.
- Se no futuro houver Stays/auto-apply, aceitar pode virar push real de preco. Isso exige auditoria, idempotencia e confirmacao forte.

Formato recomendado agora:

- Push mostra: titulo, imovel, evento, preco atual, preco sugerido e percentual.
- Action principal: `Ver recomendacao`.
- Action secundaria segura: `Lembrar depois` ou nenhuma.
- Clique abre `/dashboard?recommendationId=<id>&source=pwa_push`.
- O app autenticado mostra o card e o usuario clica `Aplicar sugestao`, `Cancelar aceite` ou `Registrar resultado`.
- Backend continua sendo a fonte de verdade via `PATCH /sugestoes-preco/:id/aceito` e `PATCH /sugestoes-preco/:id/aplicado`.

Quando quisermos action direta no push, pre-requisitos:

- Token de acao curto e assinado por usuario/recomendacao/acao.
- Expiracao curta.
- Idempotency key.
- Auditoria com IP/user-agent/subscriptionId.
- Tratamento offline/retry.
- Fallback para abrir o app se a acao falhar.
- Confirmacao no proximo acesso mostrando "Voce aceitou X as HH:mm".

## Payload PWA Recomendado

```json
{
  "type": "recommendation.created",
  "notificationId": "uuid",
  "title": "Nova sugestao de preco",
  "body": "Studio Paulista: R$200 -> R$260 por Sao Paulo Tech Week",
  "url": "/dashboard?recommendationId=analysis-uuid&source=pwa_push",
  "tag": "recommendation:analysis-uuid",
  "requireInteraction": true,
  "data": {
    "entityType": "price_recommendation",
    "entityId": "analysis-uuid"
  },
  "actions": [
    { "action": "open", "title": "Ver recomendacao" },
    { "action": "later", "title": "Depois" }
  ]
}
```

Regras:

- Nao colocar token JWT no payload.
- Nao colocar dados sensiveis ou PII alem do minimo necessario.
- Usar `tag` para colapsar duplicatas da mesma recomendacao.
- Usar `requireInteraction` apenas para recomendacoes de preco ou alertas de alto valor.
- Usar `badge`/`icon` dos assets PWA existentes.

## Arquitetura Recomendada

1. Criar entidade `push_subscriptions`:
   - `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `userAgent`, `platform`, `createdAt`, `lastSeenAt`, `revokedAt`.
   - indice unico em `endpoint`.

2. Criar `PushNotificationModule`:
   - `GET /push/vapid-public-key`
   - `POST /push/subscriptions`
   - `DELETE /push/subscriptions/current`
   - `POST /admin/push/test` para smoke admin.

3. Atualizar frontend:
   - componente opt-in de notificacoes no painel/settings, com gesto explicito.
   - `navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe(...))`.
   - enviar subscription ao backend autenticado.

4. Atualizar `sw.js`:
   - listener `push` parseando payload JSON.
   - `registration.showNotification(title, options)`.
   - listener `notificationclick` abrindo/focando `data.url`.
   - sem mutacao de aceitar/rejeitar dentro do SW na primeira versao.

5. Criar `NotificationDispatcher` no backend:
   - entrada unica: tipo, usuario, titulo, body, url, prioridade, canais.
   - canais: in-app, email, pwa.
   - cada evento decide canais com uma politica explicita.

6. Observabilidade:
   - logar envio por canal.
   - marcar subscription invalida como revoked quando push service retorna erro permanente.
   - metricas: opt-in rate, push success, click-through, recommendation accept rate por canal.

## Prioridade De Implementacao

P0:

- Centralizar payload de notificacao.
- Garantir que aceitar/aplicar recomendacao exige usuario ativo, endereco, imovel e Airbnb listing. Isso foi implementado no backend.
- Relatorio semanal de eventos por imovel via email para usuarios ativos. Isso foi implementado no backend.

P1:

- Criar tabela e endpoints de Web Push.
- Implementar opt-in no frontend e listeners no `sw.js`.
- Enviar push para `recommendation.created` e relatorio semanal.

P2:

- Action buttons no push, apenas para abrir app ou adiar.
- Deep link focalizando recomendacao no dashboard.

P3:

- Mutacao direta por action button, somente com token assinado, expiracao, idempotencia e auditoria.
