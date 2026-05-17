# Roadmap 4 Tracks - 2026-05-17

Status consolidado da squad multiagente para execucao do roadmap Urban AI.

## Placar

| Track | Dev | Foco | Pronto | Leitura |
|---|---|---|---:|---|
| Track 1 | Dev 1 | Release, CI, deploy, Railway, coordenacao e evidencias | 79% | Workflow raiz corrigido e typecheck front/back passou; ainda precisa commit/push, Railway verde e smoke autenticado configurado. |
| Track 2 | Dev 2 | Core de valor: eventos, geocoder, recomendacao, dataset e ROI | 72% | Codigo avancado; prova real depende de Geocoding API, backfill, coletores, reprocess e ground truth. |
| Track 3 | Dev 3 | Monetizacao e integracoes: Stripe, MailerSend, Stays, LGPD e suporte | 72% | Suporte/LGPD agora tem triagem, SLA, canais e painel; Stays tem preview antes do push; MailerSend e Stripe test/live aparecem no readiness. Smoke real Stripe/MailerSend/Stays ainda depende de credenciais. |
| Track 4 | Dev 4 | UX, admin, QA, Playwright, design system e smokes | 81% | Base premium forte; mutacoes reais e auditoria visual automatizada ainda precisam virar gate. |

**Prontidao geral:** 76%.

## Track 1 - Dev 1

### Bloqueios

- `main` local esta ahead de `origin/main` com um commit de release gate/interceptor ainda nao publicado.
- O workflow de release gate foi movido para `.github/workflows/release-gate.yml` e corrigido para rodar em `Urban-front-main`.
- Smoke autenticado depende de secrets/vars no GitHub.
- Railway precisa ser conferido apos o proximo push.

### Proximas acoes

1. Decidir escopo de stage/commit em meio ao trabalho paralelo.
2. Publicar o commit corrigido e acompanhar GitHub/Railway.
3. Configurar secrets do smoke autenticado no GitHub.
4. Tornar branch protection/release gate obrigatorios.
5. Atualizar este placar apos CI/deploy.

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
- LGPD/suporte tem triagem e painel; falta validar canais reais e dono operacional.

### Proximas acoes

1. Rodar runbook Stripe em staging/test mode.
2. Fazer readiness MailerSend com dominio, DKIM e envios reais.
3. Executar smoke Stays beta privado.
4. Validar canais suporte/privacidade reais e donos P0/P1.
5. Revisar copy comercial de Stays como beta privado.

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
