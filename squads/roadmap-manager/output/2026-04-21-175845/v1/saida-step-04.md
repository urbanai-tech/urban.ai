# Documentação Técnica — Daniela Documentação

**Run:** 2026-04-21-175845
**Deliverables gerados:** 1 arquivo markdown (+ atualização do roadmap no step-03)

## Arquivos criados / atualizados em `docs/`

| Arquivo | Tipo | Conteúdo |
|---------|------|----------|
| `docs/RELEASE_NOTES_SPRINT_2026-04-21.md` | Release notes completo | Descreve E1–E7 com: objetivo, impacto, endpoint/arquivo, exemplo de código, dívidas técnicas associadas. |
| `docs/roadmap-pos-sprint.md` | Roadmap (atualizado pelo Ricardo no step-03) | v2.1 com F5B + changelog. |

## Cobertura de APIs e regras novas

- **POST/GET checkout Stripe** → documentado `createCheckoutSession` com `billingCycle: 'monthly' | 'annual'` e exemplo de código completo.
- **DELETE /payments/cancelSubscription** → documentado comportamento (cancelamento imediato), edge case (sem `subscriptionId`) e roadmap UX (cancel_at_period_end).
- **PATCH /user/profile/:id** (campo novo `airbnbHostId`) → documentado o novo campo em `UpdateProfilePayload`.
- **Cron `@Cron('0 * * * *')`** em `events-enrichment.service.ts` → documentada dependência da env `GEMINI_API_KEY` com fallback.
- **Cron diário de análises aceitas** em `cron.service.ts` → documentado fluxo de notificação + e-mail.

## Dívidas explicitadas (D1–D6)

Registradas na seção "Dívidas Técnicas Abertas" do release notes, com apontamento do local e prioridade para próximo sprint. Nenhuma dívida nova foi introduzida sem ser documentada.

## O que foi propositalmente deixado de fora

- **Edição dos 32 .docx em `docs/urban-ai-documentacao/`**: não foram atualizados nesta run por decisão editorial — o release notes em markdown cobre a mudança e serve como fonte de verdade até a próxima revisão formal dos docs estruturados. **Recomendado:** sincronizar `29-changelog.docx` e `09-mapa-apis.docx` no próximo ciclo.
- **ADENDO_TECNICO_KNN.md**: mantido como está (zero mudança no repo KNN este sprint).

## Handoff para Rute

- Ler `docs/roadmap-pos-sprint.md` v2.1 (F5B + changelog)
- Ler `docs/RELEASE_NOTES_SPRINT_2026-04-21.md`
- Cruzar com `saida-step-02.md` (auditoria do Vitor) — garantir que todos os E1–E7 aparecem nos 3 artefatos com a mesma descrição e caminho de código.
