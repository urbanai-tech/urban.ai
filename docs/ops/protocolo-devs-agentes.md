# Protocolo de trabalho paralelo - Urban AI

Data: 2026-05-14
Objetivo: permitir varios chats, devs e agentes atuando nos gaps do roadmap sem sobrescrever trabalho em andamento.

## Regra rapida

- Nao editar `docs/roadmap-implementacao-gaps-produto-2026-05-14.md` como fonte unica durante execucao paralela. Registrar descobertas em arquivos auxiliares e consolidar depois.
- Antes de editar, rodar `git status --short` e verificar se o arquivo ja esta modificado por outra pessoa.
- Preferir novas paginas, docs e servicos pequenos quando o ganho for operacional e o risco de conflito for menor.
- Evitar mexer em specs E2E/unitarias quando outro chat estiver focado em testes, salvo combinacao explicita.
- Qualquer mudanca que dependa de credencial externa deve deixar fallback claro e criterio de validacao manual.

## Frentes paralelizaveis agora

| Frente | Pode rodar em paralelo | Arquivos quentes | Criterio de pronto |
|---|---|---|---|
| Core dataset/pricing | Persistir preco aplicado em `PriceSnapshot`, expor diagnosticos de dataset | `urban-ai-backend-main/src/sugestao/`, `urban-ai-backend-main/src/knn-engine/` | Preco aplicado alimenta ground truth e admin mostra crescimento de snapshots. |
| Admin/operacao | Jobs self-service, readiness, atalhos para geocoder/coletor | `urban-ai-backend-main/src/admin/`, `Urban-front-main/src/app/admin/` | Operador diagnostica/aciona top problemas sem terminal. |
| Eventos | Health de coletores, source mapping, curadoria manual/CSV | `urban-ai-backend-main/src/evento/`, `urban-webscraping-main/` | Sem falso sucesso/falso alerta e eventos futuros crescendo. |
| Prelaunch | Copy, FAQ, matriz de mensagens, waitlist diagnostics | `Urban-front-main/src/app/(public)/`, `Urban-front-main/src/app/admin/waitlist/` | M1 sem promessa quantitativa e aceite validado ponta-a-ponta. |
| Billing | Smoke Stripe, sync-check, quota/status | `urban-ai-backend-main/src/payments/`, `Urban-front-main/src/app/plans/` | Checkout/webhook/quota/cancelamento testados em ambiente correto. |
| Ops/docs | Release gate, beta playbook, smoke matrix, checkpoints | `docs/runbooks/`, `docs/beta/`, `docs/ops/` | Gate claro: PR, CI, staging, smoke, aprovacao e rollback. |

## Handoff minimo por agente/dev

Cada agente deve fechar sua rodada com:

1. Arquivos alterados.
2. Gaps do roadmap impactados.
3. Comandos de verificacao rodados.
4. Riscos ou validacoes externas pendentes.
5. O que nao mexeu de proposito para evitar conflito.

## Prioridade sugerida

1. Preco aplicado -> dataset, porque desbloqueia MAPE/ROI.
2. Admin jobs/readiness, porque reduz operacao no escuro.
3. Release gate e smoke matrix, porque estabiliza trabalho de multiplos devs.
4. Copy/FAQ e matriz de mensagens, porque libera M1 com risco comercial menor.
5. Billing e Stays somente com credenciais/ambiente certos.
