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

### Guardrails (em `StaysService.enforceVariationCaps`)

- Se variação > +25% ou < -20%: **recusa push** (BadRequestException) e grava `PriceUpdate.status='rejected'`
- Configurável por conta via `maxIncreasePercent` / `maxDecreasePercent` — o anfitrião pode afrouxar ou apertar

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
   - `ai_auto`: SIM, foi autônomo. Checar se o consentimento está gravado (User.consents), se o imóvel estava em modo auto, se a variação estava dentro do guardrail.
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
- [ ] Smoke test ponta-a-ponta executado: conectar → sync → push manual → push auto → rollback
- [ ] Load test em staging com 10 contas auto simultâneas (subset do k6 `pricing-recommendation.js`)
- [ ] Consentimento UI + gravação no User.consents validado
- [ ] Postmortem template + runbook de incidente Stays específico
- [ ] Primeiro cliente beta Stays identificado (Semana 8-9)

---

## 6. Roadmap de evolução

- **Semana 9**: OAuth 2.0 flow com Stays (se disponível) em vez de cola manual de token. Menos fricção de conexão.
- **Semana 10**: auto-match de listings Stays ↔ imóveis Urban AI por coordenadas + título (similaridade de string).
- **Semana 11**: histórico de reservas (GET /reservations da Stays) enriquece o KNN com dados reais de ocupação — desbloqueia Gap #2 da auditoria.
- **Pós go-live**: multi-canal (expandir StaysConnector para Hostaway/Hostfully como fallback).

---

*Última atualização: 24/04/2026 · F6 passo 6. Base técnica do StaysService entregue — OAuth e UI de matching em passos posteriores.*
