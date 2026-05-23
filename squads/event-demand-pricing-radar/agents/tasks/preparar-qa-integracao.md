# Task: Preparar QA e integracao

## Objetivo

Criar o trilho de qualidade para integrar as frentes sem perder contrato, confianca e release safety.

## Entradas

- plano consolidado;
- contrato minimo;
- rotas existentes;
- e2e/specs existentes.

## Trabalho

1. Criar checklist de contrato v0.
2. Criar fixtures para catalogo/radar/admin.
3. Planejar e implementar testes onde ja houver superficie:
   - catalogo host carrega;
   - detalhe mostra link oficial/fonte;
   - radar mostra imoveis impactados;
   - admin mostra blind spots/KPIs;
   - empty/error states.
4. Criar checklist de release/feature flag.
5. Registrar riscos e pendencias por frente.

## Output esperado

- Test plan.
- Specs criadas ou lista precisa de specs pendentes.
- Checklist de release.
- Riscos.
- Status de integracao.

## Veto

- Nao bloquear implementacao por falta de backend final se mocks contratuais estiverem claros.
- Nao alterar grandes areas de UI dos outros agentes.
