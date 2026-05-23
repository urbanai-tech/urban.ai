# Runbook — Setup da Integração Stays por anfitrião

**Contexto:** F6.4 do roadmap. Este runbook explica (a) como o anfitrião conecta sua conta Stays à Urban AI, (b) como o modo autônomo funciona, (c) como o time atende questões operacionais.

---

## 1. Modos de operação

Urban AI tem 2 modos de operação por conta de usuário, configuráveis também por imóvel:

### Modo Recomendação (default)

- IA gera `AnalisePreco` e exibe no dashboard.
- Anfitrião recebe e-mail diário com sugestões pendentes.
- Anfitrião clica "Aplicar" para pushar via Stays (precisa ter conta conectada) **ou** copia o valor e aplica manualmente no Airbnb.
- Logs ficam em `PriceUpdate` com `origin='user_accepted'` ou `origin='user_manual'`.

### Modo Automático

- IA gera `AnalisePreco` como no modo anterior.
- **Além disso**, o cron `stays-auto-apply` (hora em hora, 5min após hora cheia) seleciona sugestões aceitas e as empurra diretamente via Stays, sem intervenção humana.
- Guardrails impedem variações absurdas (padrão: máx +25% / -20% vs. preço anterior).
- Logs em `PriceUpdate` com `origin='ai_auto'`.

Campo `user.operationMode`:
- `'notifications'` (default): Recomendação
- `'auto'`: Automático

Campo `listing.operationMode` (por imóvel):
- `'inherit'` (default): usa o valor do `user.operationMode`
- `'notifications'`: força modo manual neste imóvel específico
- `'auto'`: força modo autônomo neste imóvel específico

Isso permite um anfitrião ter 10 imóveis, 8 em auto e 2 em recomendação manual (por exemplo, os 2 que têm hóspede específico em negociação).

---

## 2. Fluxo de conexão (lado do anfitrião)

### Pré-requisito

O anfitrião precisa ser cliente **Stays** e ter a Open API ativada (US$ 19/mês, cobrado pela Stays direto — não passa pela Urban AI).

### Passos na UI

1. Dashboard → Configurações → **Integrações** → Conectar Stays.
2. Cola `clientId` e `accessToken` obtidos no painel Stays (App Center → Open API → Generate credentials).
3. Marca o checkbox:
   > "Ao conectar minha conta Stays, eu autorizo a Urban AI a:
   >  - ler meus anúncios, calendário e histórico de reservas
   >  - aplicar preços sugeridos pela IA aos meus anúncios
   >  - armazenar esse histórico enquanto minha assinatura Urban AI estiver ativa
   >
   >  Posso desconectar a qualquer momento pelo painel — todos os dados vinculados
   >  ao Airbnb/Stays serão apagados em até 15 dias."
4. Clica **Conectar**.

### O que acontece

1. Backend chama `StaysConnector.ping()` para validar o token.
2. Se ok: persiste `StaysAccount { status: 'active' }`, grava `User.consents = [{ type: 'stays-connect', grantedAt, version: '2026-04-v1' }]` (implementação em F9.2).
3. Executa `syncListings` para puxar os imóveis Stays do anfitrião.
4. Anfitrião vê a lista de listings, escolhe qual Urban AI-property mapeia para qual Stays-listing (ou deixa autoMatch por nome/endereço — futuro).
5. Anfitrião escolhe o modo (recomendação / automático) por conta e/ou por imóvel.

---

## 3. Operação do modo autônomo

### Cron `stays-auto-apply`

- Executa a cada hora (5min após a hora cheia, timezone America/Sao_Paulo)
- Só age em listings com `operationMode = 'auto'` efetivo e `account.status = 'active'`
- Processa a última `AnalisePreco` aceita (<24h) ainda não aplicada
- Chama `StaysService.pushPrice({ origin: 'ai_auto' })`

### Kill switch global do auto-apply

O auto-apply Stays e fail-closed por padrao. Mesmo que usuario/listing esteja em modo automatico, o cron nao aplica preco real se `STAYS_AUTO_APPLY_ENABLED` nao estiver explicitamente ligado.

Envs operacionais:

| Env | Default | Uso |
|---|---:|---|
| `STAYS_AUTO_APPLY_ENABLED` | `false` | Precisa ser `true` (tambem aceito: `1`, `yes`, `on`) para permitir qualquer auto-apply. |
| `STAYS_AUTO_APPLY_DRY_RUN` | `false` | Quando `true`, o cron calcula e loga o push que faria, mas nao chama `StaysService.pushPrice`. |
| `STAYS_AUTO_APPLY_ALLOWED_USER_IDS` | vazio | Lista separada por virgula/espaco/`;`. Se preenchida, apenas esses `user.id` podem rodar auto-apply. |
| `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS` | vazio | Lista separada por virgula/espaco/`;`. Se preenchida, apenas esses `stays_listings.id` ou `staysListingId` podem rodar auto-apply. |
| `STAYS_AUTO_APPLY_COHORT` | `event-safe-beta` | Rotulo auditavel do cohort em execucao. Vai para logs e para `PriceUpdate.userAgent` no push real. |
| `STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION` | `true` | Exige `PricingDecisionSnapshot` ligado a `AnalisePreco` antes de auto-apply. |
| `STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS` | `true` | Em push real, exige allowlist de usuario e listing preenchidas. Dry-run pode ser mais amplo. |
| `STAYS_AUTO_APPLY_MIN_CONFIDENCE` | `medium` | Confidence minima da decisao de evento. |
| `STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY` | `0.45` | Probabilidade minima de absorcao do cenario recomendado. |
| `STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER` | `1.00` | Piso de multiplicador para evento; evita reducao automatica de preco no cohort de evento. |
| `STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER` | `1.25` | Teto do multiplicador seguro do cohort, antes do guardrail final do `StaysService`. |
| `STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS` | lista padrao | Flags que bloqueiam auto-apply: `low_confidence,past_event,property_unavailable,property_unavailable_for_event_window,previous_recommendation_rejected,previous_recommendation_expired`. |

Aliases tambem aceitos: `STAYS_AUTO_APPLY_USER_ALLOWLIST` e `STAYS_AUTO_APPLY_LISTING_ALLOWLIST`.

Para beta privado, recomendacao segura:

```text
STAYS_AUTO_APPLY_ENABLED=true
STAYS_AUTO_APPLY_DRY_RUN=true
STAYS_AUTO_APPLY_ALLOWED_USER_IDS=<user-id-beta>
STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS=<listing-id-beta>
STAYS_AUTO_APPLY_COHORT=event-safe-beta
STAYS_AUTO_APPLY_MIN_CONFIDENCE=medium
STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY=0.45
STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER=1.00
STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER=1.25
```

Trocar `STAYS_AUTO_APPLY_DRY_RUN=false` somente depois de validar logs, consentimento, guardrails e rollback no listing allowlisted.

### Cohort seguro para recomendacoes de eventos

O cron nao trata mais `operationMode='auto'` como suficiente para push real de evento. A decisao elegivel precisa passar por estes criterios:

- `AnalisePreco` aceita, recente (<24h) e sem `PriceUpdate.success` anterior.
- Conta Stays ativa com `consentAcceptedAt` e `consentVersion`.
- Usuario e listing em allowlist quando o push nao esta em dry-run.
- `PricingDecisionSnapshot` mais recente da analise com status `suggested` ou `accepted`.
- `confidence >= STAYS_AUTO_APPLY_MIN_CONFIDENCE`.
- `bookingProbability >= STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY`.
- `recommendedMultiplier` entre `STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER` e `STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER`.
- Preco novo nao acima do preco auditado na decisao (`selectedPriceCents` ou `recommendedPriceCents`, tolerancia de 1%).
- Nenhuma flag critica em `riskFlags` da decisao ou do `EventPropertyImpact`.
- `previousPriceCents > 0`, para permitir rollback confiavel.

Quando o push real acontece, o `PriceUpdate` mantem `origin='ai_auto'`, `analise_preco_id` e um `userAgent` tecnico no formato `urban-ai-auto-apply/1; cohort=...; decision=...; confidence=...; multiplier=...; probability=...; rollback=ready`. Isso permite ligar aplicacao, recomendacao e decisao auditavel sem sobrescrever outcomes economicos.

### Guardrails (em `StaysService.enforceVariationCaps`)

- Se variação > +25% ou < -20%: **recusa push** (BadRequestException) e grava `PriceUpdate.status='rejected'`
- Configurável por conta via `maxIncreasePercent` / `maxDecreasePercent` — o anfitrião pode afrouxar ou apertar
- Mesmo que a conta permita teto maior, o cohort de evento pode bloquear antes com `STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER`.

### Idempotência

- Chave: `sha256(listingId + date + priceCents).slice(0, 48)`
- Se já existe `PriceUpdate` com a mesma chave, reaproveitamos — nunca pushamos duas vezes o mesmo preço

### Rollback

- UI: botão "Reverter" em cada linha de `PriceUpdate` com `status='success'`
- Backend: `POST /stays/price/:id/rollback` cria novo PriceUpdate com `origin='rollback'` e preço inverso

### Error handling

- Falha de rede → retry exponencial 3x (dentro de `StaysConnector.withRetry`)
- 4xx da Stays → `PriceUpdate.status='rejected'` (não é erro nosso, é regra de negócio do outro lado)
- 5xx + rede esgotada → `PriceUpdate.status='error'` + `account.status='error'` (anfitrião é avisado por email/painel)

---

## 4. Operação do time de suporte

### "O anfitrião reclama que um preço foi aplicado sem autorização"

1. Abrir `PriceUpdate` pelo admin (painel a construir em F6.3).
2. Olhar `origin`:
   - `ai_auto`: SIM, foi autônomo. Checar consentimento em `StaysAccount`, se o imóvel estava em modo auto, se usuário/listing estavam allowlisted, se a variação estava dentro do guardrail e se `PriceUpdate.userAgent` aponta para `decision=<PricingDecisionSnapshot.id>`.
   - `user_accepted` / `user_manual`: o próprio anfitrião iniciou — mostrar IP e userAgent registrados.
3. Se for erro (guardrail quebrado, consentimento ausente): fazer rollback imediato + abrir postmortem.

### "O anfitrião quer desligar o modo autônomo para um imóvel específico"

UI: Configurações → Integrações → Stays → listagem → toggle para aquele listing. Backend: `listing.operationMode = 'notifications'`.

### "A conta Stays do anfitrião dessincronizou"

1. Verificar `account.status`. Se `error`: pedir para reconectar (gerar novo accessToken na Stays e colar na Urban AI).
2. Se o token expirou silenciosamente: `StaysConnector.ping` no próximo cron vai retornar false → marca `error` → e-mail automático ao anfitrião (alerta F9.3).

### Incidente geral (Stays fora do ar)

1. Cron detecta falhas repetidas → `account.status='error'` em massa.
2. Alerta no Sentry (F9.3).
3. Comunicação no painel aos anfitriões em modo auto: "a integração Stays está temporariamente indisponível; retorno em breve".
4. Os pushes ficam pendentes no `PriceUpdate` com status='error' — não há fila externa, a gente reprocessa chamando o cron manualmente quando o Stays voltar.

---

## 5. Checklist pré-go-live

Antes de oferecer o modo autônomo a um anfitrião real:

- [ ] Staging environment está de pé (F5C.2 item #11)
- [ ] Credenciais Stays sandbox obtidas (F6.4 reunião com Sven)
- [ ] `STAYS_API_BASE_URL` apontando para sandbox em staging
- [ ] `STAYS_AUTO_APPLY_ENABLED` ausente/false ate o beta controlado; quando ligado, usar dry-run e allowlists primeiro
- [ ] Smoke test ponta-a-ponta executado: conectar → sync → push manual → push auto → rollback
- [ ] Load test em staging com 10 contas auto simultâneas (subset do k6 `pricing-recommendation.js`)
- [ ] Consentimento UI + gravação no User.consents validado
- [ ] Postmortem template + runbook de incidente Stays específico
- [ ] Primeiro cliente beta Stays identificado (Semana 8-9)
- [ ] `PricingDecisionSnapshot` persistido para as recomendações candidatas de evento
- [ ] Cohort seguro validado em dry-run: confidence, probabilidade, multiplicador, risk flags, consentimento e rollback

---

## 6. Roadmap de evolução

- **Semana 9**: OAuth 2.0 flow com Stays (se disponível) em vez de cola manual de token. Menos fricção de conexão.
- **Semana 10**: auto-match de listings Stays ↔ imóveis Urban AI por coordenadas + título (similaridade de string).
- **Semana 11**: histórico de reservas (GET /reservations da Stays) enriquece o KNN com dados reais de ocupação — desbloqueia Gap #2 da auditoria.
- **Pós go-live**: multi-canal (expandir StaysConnector para Hostaway/Hostfully como fallback).

---

*Última atualização: 24/04/2026 · F6 passo 6. Base técnica do StaysService entregue — OAuth e UI de matching em passos posteriores.*
