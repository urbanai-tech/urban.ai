# Plano de execucao paralela: Radar de Eventos, demanda e pricing

Data: 2026-05-22
Equipe Opensquad: `event-demand-pricing-radar`
Base estrategica: `docs/plano-consolidado-inteligencia-eventos-pricing-2026-05-22.md`

## Objetivo

Desdobrar a proxima etapa do Urban AI em 5 frentes que possam andar em paralelo com agentes de IA, cada uma com ownership claro, minimo bloqueio e pontos de integracao previsiveis.

O resultado esperado e uma primeira entrega funcional do ecossistema:

- `Eventos na Cidade`: catalogo host de eventos por cidade.
- `Radar de Eventos`: host ve impacto nos seus imoveis, heatmap e oportunidades.
- `Radar de Demanda Admin`: admin ve demanda, blind spots, qualidade e impacto.
- `Event Demand Forecast`: snapshot de inteligencia do evento.
- `Price Absorption Curve`: cenarios de preco e probabilidade de absorcao.
- `pricing_decision_snapshot`: decisao auditavel conectando evento, pricing, ROI e outcome.

## Atualizacao de progresso - 2026-05-23

Leitura executiva:

- **P0/P1 tecnico comprovado:** 98%.
- **Gate Event Radar:** 100% aprovado no escopo local.
- **Release controlado com confianca de produto:** 95%.
- **Roadmap total P0-P2:** 68-72%.
- **Status:** release candidate tecnico com gate Event Radar aprovado; ultima milha fica em DB/staging/outcomes.

A diferenca entre 98%, gate Event Radar 100% e roadmap completo 100% e importante:

- **98% comprovado**: codigo, contrato, backend v0, telas Host/Admin, runner, smoke direto, gate local Event Radar 4/4, frontend typecheck, backend typecheck e Jest direcionado ampliado 59/59 ja estao verificados.
- **100% no gate Event Radar**: Playwright real passou em 2026-05-23 com preflight 200 nas quatro rotas.
- **100% do roadmap completo**: depende de DB/staging real, smoke de recompute, outcomes reais e calibracao/auto-apply.

### Percentual por frente/agente

| Frente | Percentual | Status | Proxima trava para 100% |
|---|---:|---|---|
| Lia Contratos - Backend Data & API Contracts | 95% | Entidades, migrations, endpoints Host/Admin, contratos v0 e reuso idempotente no recompute | Aplicar migrations e validar recompute em DB real |
| Nico Engine - Intelligence & Pricing Engine | 94% | Motor v0 calcula demanda, captura, curva de absorcao, cenarios e aceita calibracao por outcomes | Plugar calibracao automaticamente no recompute com amostra real |
| Maya Host - Host Event Experience | 95% | `/events`, detalhe, `/event-radar`, mapa/calendario/lista, celulas geo e sem-geo | Evidencia visual live/staging e payload persistido |
| Otto Admin - Admin Event Intelligence | 95% | `/admin/event-radar`, KPIs, blind spots, Geo Ops, mapa operacional e heatmap compacto | Reprocessamento assinc, QA staging e payload persistido |
| Tais Integracao - QA, Contracts & Release | 100% no escopo Event Radar | Contrato, fixtures, runner oficial, smoke direto, Playwright 4/4 verde e evidence docs | Repetir em staging e anexar smoke DB real |

### Percentual por entrega

| Entrega | Percentual | Leitura |
|---|---:|---|
| Contrato v0 do Radar/Eventos | 100% | Contrato, fixture e teste de contrato existem |
| Entidades/migrations de inteligencia | 90% | Estrutura pronta; falta DB real |
| Endpoints Host/Admin | 92% | Rotas e recompute v0 prontos; falta smoke real e fila/lock |
| Event Demand Forecast v0 | 88% | Motor conectado e snapshot persistido no recompute |
| Price Absorption Curve v0 | 91% | Cenarios e probabilidade implementados; falta calibracao real |
| Eventos na Cidade Host | 94% | Tela, mapa lat/lng, calendario/lista e eventos sem geo prontos |
| Radar de Eventos Host | 95% | Impactos, curva, heatmap geo, celulas e sem-geo prontos |
| Radar de Demanda Admin | 95% | KPIs, blind spots, Geo Ops e mapa operacional compacto prontos |
| `pricing_decision_snapshot` auditavel | 94% | Persistencia defensiva, outcome helper, Stays/PriceUpdate conectado e specs verdes |
| Heatmap de demanda | 95% | H3/geohash/bbox/centro, fallback derivado, sem-geo e Admin Geo Ops prontos |
| QA/E2E/Release | 100% no escopo Event Radar | Runner oficial e smoke direto prontos; gate local 4/4 verde |
| Auto-apply event-safe beta | 82% | Guardrails, allowlists, dry-run, rollback baseline, consentimento e 11 specs verdes |
| Outcomes & calibration loop | 68% | Outcome em snapshot, dataset de aprendizado e calibracao de absorcao prontos para amostra real |

### Percentual por fase

| Fase | Percentual | Status |
|---|---:|---|
| Fase 0: alinhamento de contrato | 100% | Fechado |
| Fase 1: trabalho paralelo isolado | 90% | Fatias funcionais entregues |
| Fase 2: mini-squads de integracao | 92% | Backend e experience integrados no v0 |
| Fase 3: integracao final | 96% | Typecheck/specs/ESLint direcionados, UX heatmap e gate browser 4/4 ok; falta DB/staging real |
| Release hardening | 96% | Runner endurecido, smoke direto criado e gate Playwright 4/4 aprovado |
| Aprendizado P2/outcomes/auto-apply | 68-72% | Trilha auditavel, outcome conectado, auto-apply seguro e specs verdes; falta dado real, calibracao automatica e beta |

### Como chegar ao 100%

1. Gate oficial local Event Radar: **feito em 2026-05-23**.

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 300000 --request-timeout-ms 120000 --output C:\tmp\urban-ai-event-radar-playwright
```

2. Rodar o smoke direto se o runner oficial voltar a travar em output/cache:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

3. Aplicar migrations em DB real/staging e rodar smoke de `recompute-intelligence`.
4. Registrar evidencia visual desktop/mobile das quatro rotas.
5. Confirmar feature flags/auth sem depender de fallback contratual.
6. Conectar outcomes reais de aceite/aplicacao/reserva/receita ao `pricing_decision_snapshot`.

### Rodada roadmap closure - 2026-05-23

| Frente | O que fechou | Status |
|---|---|---|
| QA Release Gate | Gate oficial 4/4, smoke direto desktop/mobile, scripts com `node --check` e ESLint | Fechado localmente |
| Backend DB & Recompute | Lock/retry, advisory lock MySQL, reuso idempotente por `jobRunId`, response com `runtime` e `writes` | Pronto para smoke staging |
| Outcomes & Learning Loop | Outcome em `pricing_decision_snapshot`, dataset e calibracao opcional para curva de absorcao | Tecnico funcional |
| Auto-Apply & Guardrails | Cohort `event-safe-beta`, allowlists, consentimento, rollback baseline, snapshot auditavel e risk flags | Beta tecnico |
| Heatmap Geo & Experience | H3/geohash/bbox/centro, fallback derivado, sem-geo, mapa Host/Admin e CTAs | 95% UX |

Proximo salto para fechar o roadmap completo:

1. Rodar migrations e recompute em staging/DB real.
2. Repetir gate Event Radar contra staging.
3. Rodar beta `event-safe-beta` com allowlists reais e rollback exercitado.
4. Ingerir reservas/outcomes Stays reais.
5. Plugar calibracao automatica no recompute quando houver amostra minima.
6. Promover heatmap persistido do backend com celulas reais e evidencia visual staging.

### Atualizacao Git/Railway/readiness - 2026-05-23

Rodada multiagentes adicional:

| Agente | Frente | Resultado | Percentual |
|---|---|---|---:|
| Curie | Backend staging readiness | Smoke `smoke:event-intelligence` dry-run criado para API real; recompute persistente apenas com `--execute` | 98% readiness |
| Lovelace | Frontend staging gate | Runner Event Radar parametrizado com `--api-url`/`E2E_API_URL` e handoff staging | 92% staging gate |
| Noether | Outcomes/calibracao | Criterios de amostra minima e relatorio dry-run de calibracao | 70% outcomes |
| Turing | Auto-apply beta ops | Runbook/envs reforcados para dry-run, allowlists, consentimento e rollback | 86% beta ops |
| Feynman | Railway/Git ops | Projetos `backend`, `Front` e `mysql` mapeados; producao em `9b853f5`; branch local de fechamento criada | 95% ops |

Validacao consolidada:

- Backend `tsc --noEmit`: verde.
- Frontend `tsc --noEmit`: verde.
- Backend Jest ampliado: **8 suites / 66 testes verdes**.
- Gate Event Radar local: segue **100%**.
- Saude publica atual: backend `/health` ok, `/health/live` ok e frontend HTTP 200.

Nova leitura:

- **P0/P1 tecnico local:** 99%.
- **Release Railway controlado:** 95-96%.
- **Roadmap total P0-P2:** 70-74%.

Pendencia nova de ambiente:

- Logs Railway mostram `GOOGLE_MAPS_API_KEY` com Geocoding API negada (`REQUEST_DENIED`/HTTP 403). Corrigir habilitacao/billing/restricoes da Geocoding API antes de exigir heatmap geo real com qualidade de producao.

Caminho de release recomendado:

1. Abrir PR da branch `codex/event-radar-roadmap-closure`.
2. Rodar CI completo e gate Event Radar.
3. Confirmar ou criar staging isolado com DB nao-producao.
4. Aplicar migrations em staging.
5. Rodar `smoke:event-intelligence --dry-run` com token admin.
6. Rodar um recompute `--execute` em evento controlado e repetir para provar idempotencia.
7. Rodar Playwright Event Radar contra front staging.
8. Somente depois promover para producao com flags fail-closed para auto-apply.

## Estrategia de paralelizacao

Os agentes devem trabalhar primeiro de forma independente ate atingirem o maximo possivel com contratos mockados ou DTOs compartilhados. Depois entram em duas mini-squads de integracao:

- Squad Backend Intelligence: contratos + motor.
- Squad Experience: host + admin + QA.

No final, todos convergem com o agente de integracao para amarrar contratos, testes e fluxo ponta a ponta.

## Os 5 agentes

### 1. Lia Contratos - Backend Data & API Contracts

Responsabilidade: criar a fundacao de dados e contratos.

Ownership principal:

- `urban-ai-backend-main/src/entities/`
- `urban-ai-backend-main/src/migrations/`
- `urban-ai-backend-main/src/admin/admin.controller.ts`
- `urban-ai-backend-main/src/admin/admin.service.ts`
- `urban-ai-backend-main/src/host-panels/`
- DTOs/types backend relacionados a eventos/inteligencia.

Entregas:

- entidade/migration `event_intelligence_snapshot`;
- entidade/migration `event_property_impact`;
- estrutura para `pricing_decision_snapshot`;
- endpoints host/admin com shape estavel;
- seeds/fixtures basicas quando fizer sentido;
- testes de contrato ou service specs basicos.

Nao deve mexer:

- telas React;
- layout/admin shell;
- styling;
- pricing formulas profundas, salvo stubs.

### 2. Nico Engine - Intelligence & Pricing Engine

Responsabilidade: implementar o motor v0 de demanda, captura e absorcao.

Ownership principal:

- `urban-ai-backend-main/src/knn-engine/`
- `urban-ai-backend-main/src/propriedades/pricing-calculate.service.ts`
- novo modulo backend para event intelligence/pricing intelligence;
- specs de scoring e absorption curve.

Entregas:

- `eventDemandScore`;
- `propertyCaptureScore`;
- `PriceAbsorptionCurve`;
- cenarios conservador/recomendado/agressivo/extremo;
- explicacoes por driver;
- integracao com `AnalisePreco` ou camada de snapshot;
- testes unitarios de cenarios.

Nao deve mexer:

- migrations estruturais sem alinhar com Lia;
- telas React;
- admin UI.

### 3. Maya Host - Host Event Experience

Responsabilidade: criar a experiencia host de descoberta e acao.

Ownership principal:

- `Urban-front-main/src/app/events/` ou `Urban-front-main/src/app/city-events/`
- `Urban-front-main/src/app/event-radar/`
- componentes host novos em `Urban-front-main/src/app/componentes/ui/` quando compartilhados;
- metodos host em `Urban-front-main/src/app/service/api.ts`;
- navegacao host quando necessario.

Entregas:

- tela `Eventos na Cidade`;
- tela `Radar de Eventos`;
- detalhe clicavel do evento;
- lista de imoveis impactados;
- visualizacao inicial de curva de absorcao;
- estados loading/empty/error;
- compatibilidade com payload mockado enquanto backend fecha contrato.

Nao deve mexer:

- admin UI;
- formulas backend;
- migrations.

### 4. Otto Admin - Admin Event Intelligence

Responsabilidade: evoluir a visao admin para demanda, blind spots e operacao.

Ownership principal:

- `Urban-front-main/src/app/admin/events/`
- possivel `Urban-front-main/src/app/admin/event-radar/`
- `Urban-front-main/src/app/admin/collectors-health/`
- `Urban-front-main/src/app/admin/coverage/`
- metodos admin em `Urban-front-main/src/app/service/api.ts`.

Entregas:

- aba/tela `Radar de Demanda`;
- tabela priorizada por potencial;
- heatmap admin inicial;
- blind spots;
- detalhe admin de evento com dados brutos + interpretacao;
- status de geocode/enrichment/source;
- links para reprocessar/editar quando endpoint existir.

Nao deve mexer:

- host pages;
- scoring backend;
- migrations.

### 5. Tais Integracao - QA, Contracts & Release

Responsabilidade: manter a entrega coesa e testavel.

Ownership principal:

- `Urban-front-main/e2e/`
- specs backend novas ou ajustes de specs;
- docs de handoff/release;
- fixtures e contrato compartilhado;
- revisao final dos fluxos.

Entregas:

- matriz de testes host/admin/backend;
- e2e basico para catalogo, radar host e admin;
- testes de contrato para responses principais;
- checklist de riscos;
- plano de rollout;
- consolidacao final de conflitos e lacunas.

Nao deve bloquear os demais no inicio. Deve trabalhar com mocks/contratos e entrar forte na fase de integracao.

## Dependencias entre agentes

| Frente | Pode iniciar sozinha? | Depende de | Handoff |
|---|---|---|---|
| Lia Contratos | Sim | plano consolidado | DTOs/endpoints para todos |
| Nico Engine | Sim | shape minimo dos snapshots | funcoes de score e scenarios para Lia |
| Maya Host | Sim | contrato mockado | necessidades de payload para Lia/Nico |
| Otto Admin | Sim | contrato mockado | necessidades de filtros/operacao para Lia |
| Tais Integracao | Sim | plano + contratos preliminares | testes e riscos para todos |

## Sequencia recomendada

### Fase 0 - Alinhamento de contrato

Duracao alvo: curto.

Objetivo:

- todos leem o plano consolidado;
- Lia define DTO preliminar;
- Nico valida campos necessarios para score;
- Maya e Otto validam se o payload atende UI;
- Tais transforma isso em checklist de contrato.

Saida:

- `docs/contracts/event-radar-contract-v0.md`

### Fase 1 - Trabalho paralelo maximo

Cada agente trabalha no seu ownership:

- Lia: entidades, migrations, endpoints skeleton.
- Nico: scoring services, absorption curve, specs.
- Maya: host catalogo/radar com mocks/contrato.
- Otto: admin radar/blind spots com mocks/contrato.
- Tais: testes, fixtures, contrato e plano de validacao.

Saida esperada:

- cada frente chega a "funciona isolado" antes da integracao total.

### Fase 2 - Mini-squads de integracao

Squad Backend Intelligence:

- Lia + Nico.
- Objetivo: endpoints reais retornam scores e snapshots persistidos.

Squad Experience:

- Maya + Otto + Tais.
- Objetivo: front consome contrato real ou adaptador unico, sem duplicar regra.

### Fase 3 - Integracao final

Todos com Tais liderando QA:

- ligar host/admin aos endpoints reais;
- remover mocks temporarios;
- validar empty/error/loading;
- rodar specs;
- documentar gaps;
- preparar checklist de release.

## Contrato minimo compartilhado

### Event catalog item

```ts
type EventCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  city: string;
  state: string;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  officialUrl?: string | null;
  source?: string | null;
  urbanScore: number | null;
  demandScore?: number | null;
  confidence?: "low" | "medium" | "high";
  badges: string[];
};
```

### Event intelligence detail

```ts
type EventIntelligenceDetail = {
  event: EventCatalogItem;
  intelligence: {
    eventDemandScore: number | null;
    eventRevenuePotentialCents: number | null;
    demandRadiusKm: number | null;
    expectedAttendance: number | null;
    sourceReliabilityScore: number | null;
    confidence: "low" | "medium" | "high";
    interpretation: string;
    drivers: Array<{ key: string; label: string; weight: number; explanation: string }>;
    riskFlags: string[];
    generatedAt: string;
    modelVersion: string;
    metricVersion: string;
    jobRunId?: string | null;
  };
};
```

### Property impact

```ts
type EventPropertyImpact = {
  propertyId: string;
  propertyName: string;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: "low" | "medium" | "high";
  recommendedAction: "watch" | "simulate" | "apply" | "review";
};
```

## Regras para evitar conflito

- Alteracoes em `Urban-front-main/src/app/service/api.ts` devem ser pequenas e agrupadas por bloco: host event radar, admin event radar, shared types.
- Maya e Otto nao devem editar o mesmo componente. Se precisarem de componente compartilhado, criar em `componentes/ui/event-intelligence/`.
- Lia e Nico devem combinar antes de alterar `AnalisePreco` ou pricing services compartilhados.
- Tais nao deve reescrever implementacao dos outros agentes; deve abrir apontamentos e patches pequenos.
- Nenhum agente deve remover alteracoes existentes no workspace.

## Definition of done por agente

### Lia

- migrations/entidades criadas;
- endpoints retornam contrato minimo;
- services nao quebram endpoints existentes;
- specs basicas passam ou gaps documentados.

### Nico

- scoring deterministico v0;
- curva de absorcao com cenarios;
- testes de borda: evento pequeno, megaevento, baixa confianca, sem comps, guardrail alto;
- explicacoes por driver.

### Maya

- catalogo host navegavel;
- radar host navegavel;
- detalhe do evento;
- estados loading/empty/error;
- CTAs presentes mesmo que alguns ainda apontem para simulacao futura.

### Otto

- admin radar com KPIs;
- blind spots;
- detalhe admin;
- filtros principais;
- status operacional claro.

### Tais

- e2e basico;
- contrato validado;
- checklist de release;
- riscos remanescentes listados;
- plano de rollback/feature flag recomendado.

## Ponto de confirmacao recomendado

Antes de rodar os agentes em paralelo, confirmar:

1. Se o escopo inicial e P0 completo ou uma fatia menor.
2. Se as rotas finais serao `/events` e `/event-radar`.
3. Se o backend deve criar tabelas novas agora ou iniciar com JSON em `AnalisePreco`/servicos.
4. Se a entrega deve ser atras de feature flag.
