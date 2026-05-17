# Roadmap 4 Tracks - 2026-05-17

Status consolidado da squad multiagente para execucao do roadmap Urban AI.

## Placar

| Track | Dev | Foco | Pronto | Leitura |
|---|---|---|---:|---|
| Track 1 | Dev 1 | Release, CI, deploy, Railway, coordenacao e evidencias | 92% | `main` publicado nos dois remotos; CI amplo e Release Gate verdes no GitHub. Restam Railway/deploy observability, secrets do smoke autenticado e branch protection. |
| Track 2 | Dev 2 | Core de valor: eventos, geocoder, recomendacao, dataset e ROI | 72% | Codigo avancado; prova real depende de Geocoding API, backfill, coletores, reprocess e ground truth. |
| Track 3 | Dev 3 | Monetizacao e integracoes: Stripe, MailerSend, Stays, LGPD e suporte | 80% | Suporte/LGPD agora tem triagem, SLA, canais, donos operacionais e painel; Stays tem preview antes do push tambem na UI; dashboard consolida go-live Track 3 e preflight local esta versionado. Smoke real Stripe/MailerSend/Stays ainda depende de credenciais. |
| Track 4 | Dev 4 | UX, admin, QA, Playwright, design system e smokes | 82% | Release Gate localizado estabilizado com smoke publico local e CI publico production-safe; mutacoes reais e auditoria visual automatizada ainda precisam virar gate. |

**Prontidao geral:** 81%.

## Track 1 - Dev 1

### Bloqueios

- CI e Release Gate estao verdes no GitHub para `11e1e7b`.
- Smoke autenticado executa o job, mas pula credenciais quando `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` nao estao configurados.
- Railway precisa ser conferido apos o push verde para confirmar deploy/health.
- Branch protection ainda precisa tornar CI/Release Gate obrigatorios em `main`.

### Proximas acoes

1. Conferir deploy/health no Railway apos `11e1e7b`.
2. Configurar `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` no GitHub para smoke autenticado real.
3. Tornar branch protection/release gate obrigatorios.
4. Preparar evidencia do CI verde e do Release Gate para o handoff.
5. Atualizar este placar apos deploy/branch protection.

## Track 2 - Dev 2

### Bloqueios

- Geocoding API precisa ser ativada no Google Cloud antes do backfill real.
- Recomendacao nova precisa smoke autenticado com Gustavo.
- Dataset/ROI ainda depende de preco aplicado, ocupacao/reserva real e snapshots por 7 dias.
- Coletores precisam comprovar `lastSeen < 48h` e eventos futuros SP/30d.

### Proximas acoes

1. Rodar backfill geocoder em dry-run e depois real.
2. Validar coletores e health operacional.
3. Reprocessar um imovel real do Gustavo.
4. Registrar preco aplicado e resultado.
5. Salvar evidencia do gate M2.

## Track 3 - Dev 3

### Bloqueios

- Smoke Stripe ponta a ponta ainda nao foi executado em ambiente real de teste.
- KYC/separacao test-live precisa confirmacao.
- MailerSend precisa entrega real validada.
- Stays depende de URL/API oficial ou sandbox.
- LGPD/suporte tem triagem, painel, contrato de donos operacionais e preflight; falta validar canais reais e preencher donos no ambiente.

### Proximas acoes

1. Rodar runbook Stripe em staging/test mode.
2. Fazer readiness MailerSend com dominio, DKIM e envios reais.
3. Executar smoke Stays beta privado.
4. Rodar `npm run preflight:track3:strict` com as envs do ambiente alvo.
5. Validar canais suporte/privacidade reais e preencher `SUPPORT_OWNER_EMAIL`/`PRIVACY_OWNER_EMAIL`.

## Track 4 - Dev 4

### Bloqueios

- Release gate visual/auditoria ainda nao e obrigatorio.
- Fluxos mutantes reais nao foram fechados.
- `/admin/properties` precisa smoke autenticado real.
- Auditor E2E ainda nao cobre todo o novo drill-down.

### Proximas acoes

1. Adicionar `/admin/properties` e detalhe ao auditor.
2. Rodar smoke mutante em staging.
3. Rodar Stripe test mode completo com evidencias.
4. Automatizar auditoria visual desktop/mobile.
5. Estabilizar seletores e `data-testid` nos fluxos criticos.

## Regra de Atualizacao

A cada rodada, atualizar:

- percentual por track;
- bloqueio principal;
- proxima acao;
- impacto no placar geral.
