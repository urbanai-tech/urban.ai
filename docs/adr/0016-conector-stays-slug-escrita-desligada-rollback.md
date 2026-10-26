# ADR 0016 — Conector Stays: slug da conta, escrita desligada por padrão, rollback

**Status:** Aceito (26/10/2026) — registra o que já vigora. O piso da auto-aplicação está em aberto: [ADR 0023](./0023-stays-automatico-abaixo-de-1x.md).

## Contexto

O conector com a Stays (`urban-ai-backend-main/src/stays/`) lê reservas e **escreve preços** no sistema do anfitrião. Dois riscos: (a) o anfitrião informar uma URL e fazer o backend chamar um destino arbitrário (SSRF); (b) um preço errado ser enviado a um canal de venda real, sem desfazer.

## Opções consideradas

1. **Aceitar a URL base da Stays digitada pelo anfitrião.** Flexível, mas vira SSRF.
2. **Allowlist de domínios sobre a URL digitada.** Ainda parseia entrada hostil.
3. **Aceitar só o identificador (slug) da conta e montar a URL no servidor** (escolhida).
4. Para escrita: ligada por padrão com guardrails, ou **desligada até habilitação explícita** (escolhida).

## Decisão

- **Destino**: o anfitrião informa apenas o slug (`^[a-z0-9-]{1,63}$`, `sanitizeStaysAccountSlug` reconstrói o valor a partir de um alfabeto constante). A URL é sempre `https://<slug>.stays.net/external/v1`, ou um host de sandbox declarado pela operação em `STAYS_ALLOWED_API_HOSTS` (`slug=host,...`). Nenhuma URL do usuário chega ao axios; redirects ficam desligados. URLs legadas são convertidas por `slugFromLegacyStaysUrl` (valor ambíguo → `null`).
- **Credencial**: o token da conta é criptografado em repouso (AES-256-GCM, `STAYS_TOKEN_ENCRYPTION_KEY`) — ver [`DICIONARIO-DE-DADOS.md`](../DICIONARIO-DE-DADOS.md).
- **Escrita desligada**: `StaysConnector.writesEnabled()` só é verdadeiro com `STAYS_PRICE_WRITES_ENABLED=true`; caso contrário `pushPrice` devolve `stays_price_writes_disabled` sem chamar a Stays. Leituras têm retry limitado com backoff; **escritas nunca são repetidas automaticamente** (um timeout pode ter aplicado o preço do outro lado).
- **Auto-aplicação** (`stays-auto-apply.service.ts`): desligada sem `STAYS_AUTO_APPLY_ENABLED=true`; tem modo `STAYS_AUTO_APPLY_DRY_RUN`, allowlists de usuário e listing, bloqueio por confiança, probabilidade de reserva e faixa do multiplicador recomendado, e é fail-closed quando o lock de Redis falha ([ADR 0017](./0017-locks-distribuidos-para-jobs-agendados.md)).
- **Rollback / re-push**: `StaysService.rollback` cria um **novo** `PriceUpdate` com `origin='rollback'`, ligado ao original (`rollbackOf`), que reenvia o `previousPriceCents`. Só se desfaz push com sucesso; cada tentativa tem `requestId` próprio (`rollback:<original>:<n>`): rollback que falhou pode ser repetido, o que deu certo é devolvido (idempotente) e um em andamento bloqueia a segunda corrida. Há teto de tentativas (`MAX_ROLLBACK_ATTEMPTS = 5`) e o contador de falhas da auto-aplicação zera no rollback.

## Consequências

- (+) Sem SSRF por entrada do usuário; nenhum preço sai para a Stays sem habilitação explícita no ambiente.
- (+) Todo push tem trilha (`price_updates` com IP/user-agent) e caminho de volta.
- (−) Rollback é um novo push, não um "desfazer" transacional: se a Stays recusar, o preço fica como está e a falha aparece no registro.
- (−) Hosts de sandbox dependem de a operação manter `STAYS_ALLOWED_API_HOSTS` correto.
- (−) `docs/product/ARCHITECTURE.md` §6.4 dizia "retry exponencial só em 5xx/rede" para o push; o código não repete escritas (corrigido junto com este ADR).
