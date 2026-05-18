# Roadmap de execucao restante - 2026-05-17

Este roadmap foca no que ainda da para fazer, em ordem operacional, sem chamar
de "credencial faltante" aquilo que pode estar configurado em Railway, banco ou
servico externo e ainda precisa apenas de validacao mascarada.

## Porcentagens atuais

| Frente | Pronto | Mudanca de hoje | Proximo passo |
| --- | ---: | --- | --- |
| Codigo/local gates | 98% | PWA MVP entrou, build Next passou, typechecks front/backend passaram e suites principais estao verdes. | Rodar suite final antes do merge. |
| Producao deployada | 94% | PR `urbanai-tech#2` foi mergeado, Railway ficou `SUCCESS` e health/app/smokes pos-deploy passaram. | Fechar mutacoes controladas e branch protection. |
| Alpha assistido | 91% | Admin segue 100%; auditoria host tem fix em codigo. | Reteste host pos-deploy com usuario real. |
| Beta pago controlado | 80% | Stripe sync-check em producao retornou 8/8 OK; suporte/privacidade publicos viraram fallback operacional, nao blocker falso. | Rodar checkout/webhook/portal/cancel/quota e confirmar owners. |
| Go-live publico | 63% | PWA, mobile autenticado e Stripe readiness ficaram mais fortes, mas ainda faltam dados/cases/legal/ops. | Cases, MAPE, LGPD e observabilidade. |
| Mobile web | 95% | Smoke autenticado mobile real passou em producao nas rotas core. | Manter gate no CI e anexar screenshots pos-deploy. |
| PWA installavel | 96% | Manifest, icons, apple icon, theme color, service worker, offline fallback, gate Playwright e installability CDP passaram em producao. | Teste instalacao Android/iOS. |
| PWA/mobile combinado | 96% | Codigo, deploy, endpoints PWA, Playwright e mobile autenticado passaram em producao. | Validar instalacao em dispositivos reais. |

## O que foi resolvido agora

| Item | Estado |
| --- | --- |
| PWA manifest | Resolvido em codigo com `public/manifest.webmanifest`. |
| PWA icons | Resolvido em codigo com `pwa-icon-192.png`, `pwa-icon-512.png`, `maskable-icon-512.png` e `apple-touch-icon.png`. |
| Service worker | Resolvido em codigo com `public/sw.js`, cache de assets e fallback offline. |
| Offline fallback | Resolvido em codigo com `public/offline.html`. |
| Metadata PWA | Resolvido em `src/app/layout.tsx`: manifest, theme color, apple web app, OG/Twitter e icons. |
| Registro do SW | Resolvido com `src/app/componentes/PwaInstaller.tsx`, ativo em production. |
| Falso blocker suporte/privacidade | Resolvido: `SUPPORT_EMAIL` e `PRIVACY_EMAIL` tem fallback do app; preflight agora alerta, nao bloqueia. |
| Owner operacional fora de `myurbanai.com` | Resolvido: owner pessoal nao bloqueia readiness; dominio diferente deve ser aviso operacional. |
| MailerSend hardcoded | Resolvido: `setup_mailersend.js` agora exige `MAILERSEND_API_KEY`/`MAILERSEND_DOMAIN_ID` via env e nao guarda token em codigo. |
| Stripe Price IDs | Resolvido em producao: `/admin/stripe/sync-check` autenticado retornou 8/8 OK, `missing: 0`, `problems: 0`. |
| Mobile autenticado | Resolvido em producao: smoke mobile real passou para dashboard, propriedades, plano, integracoes e admin properties sem overflow horizontal. |
| Gate PWA/mobile | Resolvido em codigo: `pwa-mobile.spec.ts` entrou no CI local/mock e `authenticated-mobile-smoke.spec.ts` entrou no release gate autenticado. |

## Pendencias que podem seguir sem nova credencial

1. Merge/deploy da branch atual para Railway.
2. Smoke publico pos-deploy.
3. Smoke autenticado pos-deploy com a credencial ja passada no chat.
4. Product audit completo pos-deploy.
5. Lighthouse PWA em `https://app.myurbanai.com`.
6. Smoke mobile autenticado real: login, dashboard, propriedades, calendario, planos, settings e admin.
7. Rodar Stripe checkout/webhook/portal/cancel/quota agora que `/admin/stripe/sync-check` ja confirmou 8/8 OK.
8. Reprocess/backfill do usuario Gustavo depois de resolver Google Geocoding.
9. Auditoria visual desktop/mobile das rotas core.
10. Branch protection e CI obrigatorio.

## Pendencias que dependem de validacao externa

| Item | Como validar sem expor segredo | Se falhar, ai sim e falta |
| --- | --- | --- |
| Stripe checkout/webhook | Rodar checkout test mode + webhook replay + portal + cancelamento. | Se checkout/webhook nao atualizar assinatura/quota. |
| Stripe checkout/webhook | Checkout test mode + webhook replay + portal + cancelamento. | Se Price ID/chave/webhook secret nao existirem no ambiente alvo. |
| Stays | Admin readiness ou smoke beta privado com conta controlada. | Se nao houver `STAYS_API_BASE_URL` ou token/encryption no ambiente alvo. |
| Support/LGPD owners | Admin readiness/preflight no ambiente alvo. | Se nao houver owner operacional confirmado. |
| MailerSend dominio | Envio real + checagem DKIM/SPF no painel MailerSend/DNS. | Se dominio ou API key nao estiverem ativos. |
| Google Geocoding | Rodar backfill dry-run/real e confirmar fim do 403. | Se billing/API/restricao de chave ainda bloquear. |
| GitHub Secrets | Ver checks ou settings do repo. | Se smoke CI nao receber email/senha. |
| Railway envs | Usar readiness endpoints mascarados; nao listar valores crus. | Se readiness reportar ausente. |

## Execucao passo a passo

### Fase 1 - Fechar release atual

1. Garantir que `next build`, `tsc --noEmit` front/backend e testes criticos passam.
2. Revisar diff para confirmar que nao ha segredo em arquivo.
3. Mergear branch atual para `main`.
4. Aguardar Railway backend/front/pipeline/webscraping ficarem `SUCCESS`.
5. Rodar health e smoke publico.
6. Rodar smoke autenticado com a credencial ja fornecida.
7. Rodar product audit completo e anexar relatorio em `docs/e2e-reports`.

### Fase 2 - Fechar PWA/mobile

1. Rodar Lighthouse PWA em producao.
2. Corrigir qualquer item de installability restante.
3. Testar install em Android/Chrome.
4. Testar Add to Home Screen em iOS/Safari.
5. Rodar smoke mobile autenticado real.
6. Registrar screenshots mobile das rotas core.

### Fase 3 - Monetizacao sem falso blocker

1. Registrar evidencia do `/admin/stripe/sync-check` 8/8 OK.
2. Rodar checkout test mode.
3. Rodar webhook replay.
4. Validar portal, cancelamento e quota.
5. Anexar evidencia.

### Fase 4 - Stays beta privado

1. Confirmar se ja ha sandbox/API oficial configurada no ambiente alvo via readiness mascarado.
2. Se existir, rodar connect com conta controlada.
3. Sincronizar listings.
4. Rodar preview de preco.
5. Rodar push manual de um item controlado.
6. Rodar rollback.
7. Manter feature em beta privado ate essa sequencia passar.

### Fase 5 - Dados e prova de valor

1. Resolver Google Geocoding 403.
2. Rodar backfill dos imoveis pendentes.
3. Reprocessar Gustavo.
4. Garantir cobertura de recomendacao ou motivo claro para imoveis beta.
5. Coletar 7 dias de dados reais.
6. Calcular MAPE inicial.
7. Produzir 3 cases auditados antes do go-live publico.

### Fase 6 - Operacao, legal e go-live

1. Confirmar owners operacionais de suporte/LGPD.
2. Testar inbox suporte/privacidade.
3. Confirmar DPAs prioritarios.
4. Rodar backup off-site e restore drill.
5. Ativar branch protection.
6. Ativar GA4/Meta reais.
7. Recrutar leads e registrar conversao.
8. Aprovar go/no-go com evidencias.

## Bloqueios reais neste momento

| Bloqueio | Tipo | Observacao |
| --- | --- | --- |
| Deploy da branch atual | Operacional | Pode seguir agora. |
| Stripe checkout/webhook/portal | Validacao externa | Price IDs ja passaram 8/8 em producao; falta smoke mutante controlado. |
| Stays | Validacao externa | Se nao houver API/base/token no ambiente alvo, e bloqueio real. |
| Google Geocoding 403 | Conta/API externa | Precisa billing/API/restricao correta. |
| Owners suporte/LGPD | Operacional | Email publico tem fallback; owner ainda precisa confirmacao. |
| CI obrigatorio | GitHub | Pode seguir via repo settings/secrets. |

## Definicao de 100%

Chegamos em 100% quando:

- producao roda a branch atual;
- PWA passa Lighthouse/install em prod;
- host/admin passam product audit completo;
- Stripe checkout/webhook/portal/cancel/quota passam em test mode ou live controlado;
- Stays passa connect/sync/preview/push/rollback ou fica explicitamente fora do escopo publico;
- Geocoding/backfill/reprocess passam;
- CI obrigatorio protege `main`;
- 3 cases e 7 dias de dados reais sustentam a narrativa publica.
