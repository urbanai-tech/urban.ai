# Release Evidence 100 - Handoff

Data: 2026-05-22
Frente: Release Evidence 100
Escopo: documentar criterio objetivo de 100% para Event Radar/Playwright sem executar comandos.

## Objetivo

Definir, nos documentos de status/evidencia/checklist, o que significa chegar a 100% no Event Radar/Playwright e separar claramente:

- o que ja esta provado;
- o que depende da execucao final do gate;
- qual resultado autoriza atualizar o status para 100%.

## Criterio de 100%

O status so deve ser alterado para 100% quando o comando abaixo rodar com sucesso:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Condicoes obrigatorias:

- exit code 0;
- 4/4 testes Playwright passando em browser real;
- preflight HTTP aprovado para `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar`;
- artefatos gravados fora do OneDrive;
- evidencia final registrada com comando, base URL, porta, data/hora e caminho dos artefatos.

## Evidencia consolidada como ja provada

- Rotas alvo ja responderam HTTP 200 em tentativa limpa.
- Browser Playwright direto abriu `/events` com HTTP 200.
- Spec permanece sem skips conhecidos.
- Modo de listagem encontra 4 testes.
- Bloqueio anterior foi isolado como ambiente/cache/artefatos no OneDrive.
- Runner ja foi ajustado para gravar em `C:\tmp\urban-ai-event-radar-playwright` ou caminho indicado por `--output`/`E2E_OUTPUT_DIR`.

## Arquivos atualizados

- `docs/evidence/event-radar-playwright-fix-2026-05-22.md`
- `docs/contracts/event-radar-release-checklist-v0.md`
- `docs/contracts/event-radar-qa-test-plan-v0.md`
- `docs/status-entregas-radar-eventos-2026-05-22.md`
- `squads/event-demand-pricing-radar/output/2026-05-22-playwright-100/release-evidence-100.md`

## Observacao

Nenhum comando foi executado nesta frente, conforme solicitado. Esta entrega e documental: ela deixa o release pronto para a tentativa final e impede que o status seja marcado como 100% sem evidencia objetiva.
