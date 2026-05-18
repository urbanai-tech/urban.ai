# Indice dos roadmaps e status consolidado

Atualizado em 2026-05-17 apos fechamento PWA/mobile, auditoria admin/host,
sync-check Stripe e push para os dois remotes.

## Documentos principais

| Documento | Para que usar | Estado |
| --- | --- | --- |
| `docs/roadmap-4-tracks-2026-05-17.md` | Placar por dev/track e divisao operacional | Fonte principal por squad |
| `docs/roadmap-execucao-restante-2026-05-17.md` | Passo a passo do que ainda da para executar | Fonte principal de acao |
| `docs/roadmap-consolidado-gaps-manuais-2026-05-17.md` | Gaps manuais, externos, PWA/mobile e leitura executiva | Fonte principal de bloqueios |
| `docs/runbooks/e2e-admin-host-tester-completo.md` | Roteiro completo para tester rodar Admin + Host | Novo runbook de QA |
| `docs/runbooks/track3-handoff-manual.md` | Monetizacao, Stripe, MailerSend, Stays e suporte/LGPD | Apoio Track 3 |
| `docs/runbooks/stripe-billing-smoke.md` | Smoke Stripe checkout/webhook/portal/cancel/quota | Pendente de execucao controlada |
| `docs/runbooks/stays-beta-private-smoke.md` | Smoke Stays beta privado | Depende de Stays oficial/sandbox |
| `docs/runbooks/release-gate.md` | Gate antes de promover release | Usar apos merge/deploy |

## Percentuais por frente

| Frente | Percentual | Estado agora | Para chegar a 100% |
| --- | ---: | --- | --- |
| Codigo/local geral | 98% | Builds, typechecks e suites principais verdes | Rodada final completa antes do merge |
| Producao deployada | 84% | Railway saudavel, mas precisa receber branch atual | Merge, deploy e smoke pos-deploy |
| Track 1 - Release/CI/Railway | 99% | CI/release gates e evidencias estruturados | Branch protection, secrets e deploy final |
| Track 2 - Core de valor | 94% | AskUrban, pricing, ROI, admin/alpha e APIs core avancados | Geocoding, backfill, dados reais e ground truth |
| Track 3 - Monetizacao/integracoes | 97% codigo, 82% operacional | Stripe sync-check 8/8 OK e runbooks prontos | Checkout/webhook/portal/cancel/quota, Stays e owners |
| Track 4 - UX/Admin/QA/PWA | 98% | Admin 100%, PWA MVP, mobile smoke e footer fix em codigo | Deploy/reteste host, Lighthouse e mutacoes staging |
| Admin read-only | 100% | Auditoria Admin passou incluindo propriedades e detalhe | Manter no CI e repetir pos-deploy |
| Admin mutante/ops | 87% | Jobs, readiness e logs estruturados | Mutacoes controladas em staging |
| Host read-only | 86% | APIs 100%; UI tinha footer fix pendente de deploy | Reteste pos-deploy para voltar acima de 95% |
| Mobile web | 95% | Smoke autenticado mobile passou em rotas core | Screenshots pos-deploy e gate continuo |
| PWA installavel | 90% | Manifest, icons, SW, offline e metadata prontos | Lighthouse/install Android/iOS pos-deploy |
| Billing/Stripe | 82% | Price IDs OK em producao | Smoke mutante controlado |
| MailerSend | 78% | Codigo e env-base encaminhados | Dominio/DKIM/SPF e envio real |
| Stays | 42% | Beta privado/fail-closed/readiness existem | API/base/token/sandbox e smoke real |
| Legal/LGPD/suporte | 68% | Termos/privacidade publicados e fallback publico | Owners, inbox real, DPAs e revisao final |
| Marketing/prelaunch | 82% | Landing/waitlist/copy/funil basico | GA4/Meta reais e leads/cases |
| Dados, ROI e cases | 76% | ROI/snapshots/ocupacao manual existem | 7 dias reais, MAPE e 3 cases |
| Webscraping/eventos | 68% | Pipeline e fallbacks existem | lastSeen, volume SP/30d e ambiente webscraping |
| Go-live publico | 63% | Base tecnica forte | Cases, observabilidade, legal, billing live e operacao |

## Etapas do roadmap restante

| Etapa | Percentual | Bloqueio principal | Proximo passo |
| --- | ---: | --- | --- |
| 1. Release atual | 88% | PR ainda nao mergeado/deployado | Mergear, aguardar Railway e rodar health |
| 2. PWA/mobile | 93% | Precisa validacao pos-deploy/dispositivos | Lighthouse e install Android/iOS |
| 3. Monetizacao | 80% | Falta smoke mutante Stripe | Rodar checkout/webhook/portal/cancel/quota controlado |
| 4. Stays beta privado | 42% | Falta Stays oficial/sandbox no alvo | Validar readiness mascarado e smoke |
| 5. Dados/prova de valor | 76% | Google Geocoding 403 e dados reais | Corrigir Google, backfill e 7 dias de coleta |
| 6. Operacao/legal/go-live | 63% | Owners, DPAs, backups, branch protection e cases | Fechar checklist manual e go/no-go |

## Bloqueios reais

| Bloqueio | Tipo | Observacao |
| --- | --- | --- |
| Merge/deploy | Operacional | Codigo ja esta pronto na branch; producao precisa receber |
| GitHub Actions no repo Gustavogm9 | Conta GitHub | Jobs bloqueados por billing/spending, nao por codigo |
| Stays | Credencial/servico externo | Usuario indicou que Stays e o que ainda nao temos |
| Google Geocoding 403 | Conta/API externa | Impede backfill completo |
| Stripe mutante | Validacao controlada | Price IDs OK; falta fluxo ponta a ponta |
| Host UI | Deploy/reteste | Bug do footer esta corrigido em codigo |
| PWA install | Validacao device | Precisa teste real apos deploy |
| Owners suporte/LGPD | Operacional | Email publico tem fallback; owner precisa confirmacao no ambiente |

## Ordem recomendada

1. Mergear PR no `urbanai-tech` quando Playwright pendente terminar verde.
2. Confirmar deploy Railway em todos os servicos.
3. Rodar `docs/runbooks/e2e-admin-host-tester-completo.md`.
4. Rodar Lighthouse/install PWA.
5. Rodar Stripe smoke controlado.
6. Resolver Google Geocoding e executar backfill/reprocess.
7. Validar Stays quando houver credencial/API oficial.
8. Ativar branch protection e CI obrigatorio.
9. Fechar owners, DPAs, backup/restore e 3 cases.
