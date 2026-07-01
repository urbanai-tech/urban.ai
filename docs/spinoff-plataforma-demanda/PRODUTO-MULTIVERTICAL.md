# Spinoff — Plataforma de Demanda Multi-Vertical

**Status:** PRODUTO SEPARADO (spinoff). NÃO faz parte do produto core Urban AI (hospedagem).
**Versão:** 1.0 (consolidada do pacote `docs/v2-2026-05-24/` em 2026-06-21)
**Propósito:** registrar a tese de aplicar o motor de demanda a outros setores (mídia, staffing, estacionamento, comida, estética), os beachheads e a camada de plataforma que tornaria isso possível.

> **Fronteira com o core (importante):**
> - **Core (Urban AI hospedagem):** o **radar de eventos/demanda que alimenta o pricing de imóveis** é parte do produto principal — está em `../product/PRD.md` e `../product/ARCHITECTURE.md`, e já existe no código.
> - **Spinoff (este doc):** a **generalização do mesmo motor para outros setores** como produto próprio. É majoritariamente **estratégia/roadmap não-implementado**.
>
> Não misturar a narrativa multi-vertical no produto core.

---

## 1. Tese central

A Urban AI captura e normaliza **eventos urbanos**, mapeia **impacto por localização**, recomenda **ação** e registra **resultado**. Esse fluxo — `sinal → impacto → ação → outcome → aprendizado` — **não é exclusivo de hospedagem**. Vale para qualquer operação que sofra com picos locais de demanda.

O moat é o **dataset proprietário de demanda urbana** (evento → região → preço/decisão → reserva/receita). Quanto mais outcomes, mais defensável.

Narrativa de posicionamento (evita parecer pequeno ou genérico demais):
- **Hoje:** pricing + radar de eventos para hospedagem.
- **V2:** revenue intelligence para administradoras e hosts profissionais.
- **Futuro:** inteligência de demanda urbana para múltiplos setores.

---

## 2. Camada fundacional de plataforma (P0 — destrava tudo)

Funcionalidades que ajudam hospedagem **e** permitem absorver novos setores sem reescrever o produto. Esta é a ponte entre "app de Airbnb" e "plataforma de demanda".

| Bloco | O que faz | Por que importa |
|-------|-----------|-----------------|
| **Urban Signal Graph** | Liga evento ↔ local ↔ tempo ↔ ativo ↔ impacto ↔ ação ↔ outcome | Base comum a todos os setores |
| **Demand Impact Score** | Score padronizado de impacto por evento/microzona/ativo | Comparar oportunidades entre setores |
| **Action Recommendation Engine** | Recomenda a melhor ação por setor | Sai de dashboard para decisão |
| **Decision Snapshot** | Grava por que recomendou (já existe parcial — `PricingDecisionSnapshot`) | Auditabilidade e confiança |
| **Outcome Ledger** | Mede aceite, aplicação, resultado, feedback | Prova valor e treina modelo |
| **Asset Abstraction** | Trata imóvel, loja, vaga, tela, rota como ativo configurável | Evita reescrever por setor |
| **Sector Configuration Layer** | Nomes, métricas, ações e templates por vertical | Acelera pilotos |
| **Report/Brief Builder** | Gera PDFs/briefs por setor | Vender setor novo antes do app inteiro |

P1: Partner/API Layer, Territory/Geo-Fence Manager, Experiment/Pilot Console, Data Quality Console.

---

## 3. Roadmap do core de hospedagem (próximas features)

Prioridades altas do `roadmap-funcionalidades-futuras-core-expansao.md` (esforço×impacto):

| Feature | Horizonte | Nota |
|---------|-----------|------|
| **Decision Inbox** (fila de decisões do dia) | 0–60d | substitui "navegar telas" por "aprovar/recusar" — gera dados de aprendizado |
| **Calendário inteligente com camada de eventos** | 0–60d | host precisa "ver dinheiro no calendário" |
| **Cenários de preço** (conserv./recom./agress./extremo/não agir) | 0–60d | já parcial nos snapshots |
| **Event-to-Property Impact** (tabela imóvel×evento) | 0–90d | vira API/relatório/material |
| **Prova de ROI por recomendação** (potencial/projetado/confirmado/evitado) | 0–90d | separar fato de estimativa |
| **AskUrban contextual** (com dados reais, não template) | 0–90d | hoje é determinístico (ver PRD §4.10) |
| **Retrospectiva de oportunidade perdida** | 0–90d | ótimo para vender upgrade |
| **Portfolio Cockpit p/ administradoras** | 60–120d | bulk actions já existem; falta aprovação/relatório ao dono |
| **Stays Beta 2.0** (sync calendário/preço/restrições + auto-apply por regra) | 60–120d | exige dry-run/allowlist/rollback |
| **Owner/Investor Report** | 60–120d | administradora vende valor ao dono |
| **Recomendação de restrições** (min-noites, gap nights, descontos) | médio | revenue management real |
| **Playbooks de revenue management** | médio | templates de estratégia |

---

## 4. Beachheads em hospedagem (foco imediato)

| Beachhead | ICP | Hipótese de preço | Estágio |
|-----------|-----|-------------------|---------|
| **Administradoras Stays em SP** (principal) | 20–150 imóveis, usam PMS | R$ 800–2.500/mês + R$ 15–35/listing | beta assistido |
| Hosts profissionais 5–20 | zonas de eventos (Paulista, Pinheiros, Barra Funda, Anhembi, Allianz, Interlagos…) | R$ 99–299/mês | PLG/premium |
| Hosts individuais 1–3 | topo de funil | free / R$ 39–79/mês | leads/dados |
| PMS/Channel manager (API) | pós-cases | conforme modelo | depois |
| Boutique/apart-hotels urbanos | sem RMS sofisticado | ticket maior | médio prazo |

Experimento-âncora: 3 administradoras, 30 dias, medir recomendações → aceites → aplicações → receita projetada → **3 cases auditados**.

---

## 5. Verticais adjacentes (futuro, fora de hospedagem)

> Reaproveitam o mesmo motor de demanda. Estágio: ideia/validação via brief, antes de produto.

**Prioridade A (testar cedo via relatório, sem mudar o core):**
- **Mídia OOH/DOOH, retail media, ativação/patrocínio** — "Urban Event Media Brief": ranking de eventos por bairro/venue/intensidade, janelas e fit por categoria de marca. Alto ticket, usa dado atual, sem integração no MVP.
- **Staffing / segurança / limpeza / mão de obra temporária** — "Urban Operations Demand Radar": alerta de demanda operacional e previsão de equipe.
- **Estacionamentos / valets / mobilidade** — "Urban Parking Demand Radar": score de lotação + recomendação de preço/equipe.

**Prioridade B (médio prazo):** restaurantes/franquias (Store Demand Calendar), distribuidores/foodservice B2B (pré-venda por evento), real estate/site selection (Urban Location Score), turismo corporativo/procurement (city compression calendar).

**Prioridade C (futuro, com condições):** organizadores/venues (Event Impact Report), DMOs/desenvolvimento econômico, seguros/risco urbano, telecom (forecast de carga), fintech/crédito (sinal alternativo).

**Verticais com produto desenhado:**
- **Comida ultra-resfriada** — "Urban Fresh Demand OS" (forecast de produção, allocation, shelf-life risk, campaign trigger). Melhor ICP: geladeiras inteligentes em academias/empresas. MVP: "Fresh Demand Brief" semanal.
- **Procedimentos estéticos / medspas** — "Urban Beauty Demand OS" (calendário de demanda, timing de campanha, preenchimento de agenda, lead priority, retenção). **Guardrail crítico:** Urban não recomenda procedimento clínico — decisão é do profissional (CFM/Anvisa). MVP: "Beauty Demand Brief" semanal.

---

## 6. Sequência recomendada

- **0–30d:** focar SP (administradoras/hosts profissionais), 50 leads, beta assistido p/ 3–5; criar 3 demos setoriais (mídia/staffing/estacionamento) **sem mexer no core**.
- **30–60d:** fechar 3 cases em hospedagem; validar 3 beachheads não-óbvios (15 conversas/área); escolher 1 frente para piloto pago.
- **60–90d:** expandir Rio/Floripa só se SP tiver case; conversa com PMS; decidir o caminho de 1 vertical (produto separado / módulo / relatório premium / API / tese de investidor).

---

## 7. Narrativa para investidores

Três ativos: **produto** (experiência de decisão), **dados proprietários** (outcome ledger evento→preço→resultado), **operação** (governança, runbooks, segurança, arquitetura escalável). Estado: beta operacional avançado; foco agora é **provar valor em campo com poucos clientes e medir outcome honestamente**. Plano executivo em 5 marcos: operação pronta p/ beta → recomendações auditáveis → medir resultado → beta pago + cases → escala com auto-apply seguro.

> Disciplina exigida pelo material: nada de promessa quantitativa sem case auditado; todo número com fonte, data e ressalva.

---

## 8. Mercado (números citados nos docs v2, conferir antes de usar externamente)
ABRAPE 2025: setor de eventos ~R$ 141,1 bi; SPTuris 2025: +54% turismo em SP; AirDNA: ~60 mil propriedades STR em SP (~55% ocupação); IAB Brasil: publicidade digital R$ 42,7 bi (2025). *Fonte: pacote v2; validar antes de usar em material público.*
