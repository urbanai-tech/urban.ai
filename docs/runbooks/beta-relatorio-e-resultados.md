# Beta pago — resumo semanal, cobrança assistida e resultados

O beta começa já medido. Este runbook descreve o que foi montado em cima do que existia e como operar.

## 1. Resumo semanal por anfitrião

Um único e-mail por semana por anfitrião (o antigo "radar semanal de eventos" foi estendido, não duplicado).
Código: `urban-ai-backend-main/src/email/weekly-event-report.service.ts` (envio) e
`weekly-host-report.ts` (agregação pura e testada).

- **Quando:** segunda 08:30 BRT (`@Cron`), uma vez por semana de calendário de São Paulo. A trava é
  `ScheduledJobRunnerService.runOncePerWindow` (`GET_LOCK` no MySQL + execução `success` em `admin_job_runs`
  na janela), com chave = segunda 00:00 BRT. Duas réplicas nunca enviam duas vezes.
- **Quem recebe:** usuário ativo com direito de uso (assinatura/trial/alpha) e `weeklyReport` ligado nas
  preferências. Opt-out por link no e-mail (`weekly_report`) ou em `/settings/communications`.
- **Conteúdo por imóvel:** semana passada (segunda a domingo, BRT): recomendações novas, aceitas, preços
  aplicados (sugerido x o que o anfitrião aplicou), resultados registrados (e receita/noites **só se ele
  registrou**), lembrete dos resultados pendentes; e os eventos relevantes (próximas 2 semanas em destaque e
  janela de `WEEKLY_EVENT_REPORT_LOOKAHEAD_DAYS`).
- **Honestidade:** onde não há registro o e-mail escreve "sem dados" (nunca zero) e não estima receita.
  Se não há evento nem atividade nem pendência, o e-mail não é enviado.
- **Desligar:** `WEEKLY_EVENT_REPORT_ENABLED=false`.

## 2. Resultados depois do evento

O calendário do painel só lista eventos de hoje em diante, então antes não havia caminho no app para informar
o resultado depois do evento. Agora:

- `GET /sugestoes-preco/resultados-pendentes` devolve os preços aplicados com evento já passado (dia de SP) e
  sem resultado; o painel mostra o bloco "Como foi?" com o mesmo cartão e o mesmo "Registrar resultado".
- O e-mail semanal repete o lembrete (até 5 por imóvel, com link para o painel).
- Onde ficam os dados: `analise_preco` (`preco_aplicado`, `aplicado_em`, `reserva_status`, `receita_real`,
  `noites_reservadas`, `resultado_registrado_em`). Resultado "registrado" exige o carimbo **e** um dado
  concreto (reservou/não reservou/bloqueado, receita ou noites).

## 3. v1 × v2 (sombra)

Com `PRICING_ENGINE_V2=shadow` o v1 responde e o v2 é calculado ao lado. Antes ele só ia para um log de debug;
agora o preço v2 e a versão do motor ficam em `analise_preco.shadow_v2_preco` / `shadow_v2_versao` (migration
`1793100000000-AddShadowV2ToAnalisePreco`). Só análises geradas/recalculadas depois do deploy têm v2.

`/admin/outcomes` (`GET /admin/outcomes/comparison`) compara, para recomendações com preço aplicado **e**
resultado registrado: v1, v2, aplicado, resultado e qual sugestão ficou mais perto do preço aplicado. Com
n < `OUTCOMES_COMPARISON_MIN_SAMPLE` (30) mostra n e contagens e nenhuma conclusão. Não é teste A/B: o anfitrião
decide o preço e nunca vê o v2.

## 4. Cobrança assistida (admin)

`/admin/billing-hosts` (`GET /admin/billing/hosts`) lista os anfitriões com o estado real da assinatura (mesma
regra do bloqueio 402: trial com dias restantes, ativo, pagamento falhou, cancelado, sem assinatura...).
O botão "Enviar link" (`POST /admin/billing/hosts/:userId/send-link`) usa o que o sistema já gera:

| Situação | Link enviado |
|---|---|
| Assinatura viva (ativa, trial, pagamento falhou) com cliente no Stripe | Portal de cobrança (`createBillingPortalSession`) |
| Sem assinatura, cancelada, vencida | Checkout (`createCheckoutSession`): trial se ainda não usou; senão mesmo plano/ciclo/quantidade da última assinatura |

O link vai **por e-mail ao próprio anfitrião**, nunca na resposta HTTP nem no log de auditoria. Limite de 10
envios por minuto por admin; toda chamada é auditada (`admin_audit_log`). Não cria produto nem preço no Stripe.
"Último evento de cobrança" é a última atualização de webhook do Stripe, não a data do último pagamento (o
sistema não guarda valor/data de fatura).
