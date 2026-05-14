# Release gate - Urban AI

Data: 2026-05-14
Escopo: fluxo minimo para promover mudancas rumo a M1/M2/M3 sem repetir hotfix direto em producao.

## Fluxo obrigatorio

1. Abrir PR ou consolidar branch de trabalho.
2. Rodar verificacoes locais da area alterada.
3. CI verde.
4. Deploy em staging ou ambiente controlado equivalente.
5. Smoke operacional conforme matriz abaixo.
6. Aprovar promocao para producao.
7. Monitorar dashboard admin, logs e alertas por 30 minutos.

## Smoke minimo por frente

| Frente | Smoke obrigatorio | Evidencia |
|---|---|---|
| Prelaunch/waitlist | `/create` em modo prelaunch, signup, admin invite, aceite de convite | Print ou log com waitlist `converted`. |
| Eventos | `/admin/events`, `/admin/collectors-health`, geocoder manual quando houver pendentes; se `next30d < 100`, seguir `docs/runbooks/eventos-fallback-manual.md` | Contagem de eventos futuros, `lastSeen` por source e evidencia do sourceLabel importado. |
| Recomendacoes | Seguir `docs/runbooks/recomendacao-nova-smoke.md` para reprocessar pelo menos 1 imovel em ambiente controlado | `AnalisePreco.criadoEm` atual, evento futuro, motivo visivel no dashboard e registro de evidencia. |
| Dataset/ROI | Seguir `docs/runbooks/dataset-ground-truth-smoke.md`: registrar preco aplicado e rodar snapshot manual | `PriceSnapshot` com `appliedPriceCents` ou motivo de skip acionavel, dashboard atualizado e evidencia registrada. |
| Billing | Seguir `docs/runbooks/stripe-billing-smoke.md`: sync check, checkout test/live definido, webhook, quota e cancelamento | `/admin/stripe/sync-check` sem problemas, evento Stripe refletido no DB, quota correta e evidencia registrada. |
| Stays | Seguir `docs/runbooks/stays-beta-private-smoke.md`: somente beta privado, connect/sync/push/rollback em sandbox | `PriceUpdate` success, rollback success, token criptografado, consentimento rastreavel e evidencia registrada. |
| Beta fechado | Seguir `docs/runbooks/beta-fechado-assistido.md` para recrutar/onboardar 5-10 anfitrioes assistidos | Relatorio semanal com recomendacoes, aceite, preco aplicado, bugs e decisao de manter/ampliar/bloquear. |
| Admin/ops | `/admin/dashboard` e `/admin/jobs` carregando sem erro | Alertas coerentes, sem falso sucesso/falso alerta conhecido. |

## Nao promover se

- Backend build falhar.
- Frontend build falhar.
- Waitlist invite aceitar token expirado ou reutilizado.
- Recomendacao nova nao puder ser provada em ambiente controlado para M2.
- `events.next30d` estiver abaixo do alvo e nao houver curadoria manual ativa.
- Stripe live/test estiver misturado ou sync check apontar Price ID ausente para M3.
- Stays estiver visivel como automatico pronto sem credenciais, consentimento e rollback.
- Alteracao depender de env externa sem fallback claro.

## Rollback minimo

- Frontend: reverter deploy para build anterior.
- Backend: reverter deploy para release anterior; se houve migration, confirmar se e forward-only ou se exige plano manual.
- Banco: nao rodar rollback destrutivo sem backup e aprovacao explicita.
- Stripe/Stays: pausar feature flag ou esconder UI antes de mexer em dados externos.

## Registro de release

Cada promocao deve registrar:

- Data/hora.
- Commit/branch.
- Responsavel.
- Ambiente.
- Smokes rodados.
- Evidencias.
- Decisao: aprovado, bloqueado ou rollback.
- Pendencias para a proxima janela.
