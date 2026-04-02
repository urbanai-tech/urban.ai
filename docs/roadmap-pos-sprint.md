# Urban AI — Roadmap Pós-Sprint
**Versão 1.0 · Início: 21/03/2026 · Base: Sprint de migração encerrado em D14 (20/03/2026)**

> O sprint de 14 dias úteis foi concluído com 53 entregas. O sistema está 100% operacional sob controle Urban AI. Este documento cobre o que vem a seguir — pendências em aberto, crescimento e go-live oficial.

---

## Legenda
- ✅ Concluído
- 🔄 Em andamento
- ⬜ Pendente
- 🔴 Bloqueante — impede avanço
- 💰 Há custo envolvido

---

## PENDÊNCIAS EM ABERTO (carryover do sprint)

> Itens que não foram concluídos no sprint de migração. Devem ser resolvidos antes ou em paralelo com F5.

| Status | Item | Responsável | Prazo estimado | Observação |
|--------|------|-------------|----------------|------------|
| 🔄 | **KYC Stripe** — submeter RG/CPF dos sócios majoritários + contrato social + dados da conta PJ | Gustavo | Semana 1 | Docs em reunião. Após submissão: aprovação em 1–3 dias úteis. Desbloqueia cobranças reais. |
| 🔄 | **Transferência domínio urbanai.com.br** — processo formal em andamento com Lumina Lab | Gustavo + Lumina | 2–5 dias úteis | Apontamento temporário já ativo. Não bloqueia operação. |
| 🔄 | **Transferência domínio myurbanai.com** — aguardando Lumina Lab concluir | Lumina Lab | 2–5 dias úteis | Sistema já operando via app.myurbanai.com. Não bloqueia operação. |

---

## F5A — Validação de Produto, UX e Fluxos Reais ⚡ (paralelo à F5)
**Objetivo:** Garantir que o sistema funciona de ponta a ponta com dados e usuários reais, corrigindo todos os problemas de UX, fluxo e onboarding antes de gerar tráfego pago.
**Período estimado:** Semanas 1–4 (21/03 → 18/04/2026) — em paralelo com F5
**Prioridade:** 🔴 Alta — problemas identificados no sprint bloqueiam retenção de usuários

> ⚠️ **Contexto:** Durante os testes do sprint foram identificados problemas no cadastro (UX, botões, tratamento de erro), ausência de onboarding, falhas no cadastro de imóveis e inconsistências no fluxo real de uso. Esta fase resolve todos esses pontos antes de escalar aquisição.

### 5A.1 Cadastro e Autenticação — UX e Erros

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Mapear todos os erros de formulário sem feedback visual (campos obrigatórios, formato inválido) | S1 | Gustavo |
| ⬜ | Corrigir mensagens de erro genéricas — substituir por mensagens claras e acionáveis | S1–2 | Gustavo / Dev |
| ⬜ | Revisar estados dos botões: loading, disabled, sucesso e erro em todos os CTAs | S1–2 | Gustavo / Dev |
| ⬜ | Corrigir fluxo de confirmação de e-mail — garantir que link chega e redireciona corretamente | S1–2 | Gustavo / Dev |
| ⬜ | Revisar fluxo de recuperação de senha de ponta a ponta (UI + e-mail + redirect) | S2 | Gustavo / Dev |
| ⬜ | Testar login com Google OAuth — cobrir edge cases (conta já existente, e-mail diferente) | S2 | Gustavo / Dev |

### 5A.2 Onboarding — Criação do Fluxo (não existia)

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Definir jornada do onboarding: quais etapas, em que ordem, o que é obrigatório vs. opcional | S1 | Gustavo |
| ⬜ | Criar tela de boas-vindas pós-cadastro com próximos passos claros | S2 | Gustavo / Dev |
| ⬜ | Implementar checklist de setup do perfil (foto, nome, primeiro imóvel) | S2–3 | Gustavo / Dev |
| ⬜ | Criar tooltip/guia contextual na primeira visita ao dashboard | S3 | Gustavo / Dev |
| ⬜ | Configurar sequência de e-mails de onboarding via Mailersend (D1, D3, D7) 💰 | S2–3 | Gustavo / Dev |
| ⬜ | Testar onboarding completo com 2–3 usuários internos e coletar feedback | S3–4 | Gustavo |

### 5A.3 Cadastro de Imóveis — Fluxo e Validações

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Auditar formulário de cadastro de imóvel: campos, ordem, clareza dos labels | S1 | Gustavo |
| ⬜ | Corrigir campos obrigatórios sem validação + mensagens de erro ausentes | S1–2 | Gustavo / Dev |
| ⬜ | Garantir que imóvel cadastrado aparece imediatamente no dashboard (sem refresh manual) | S2 | Gustavo / Dev |
| ⬜ | Revisar fluxo de edição de imóvel — dados pré-preenchidos, confirmação de salvar | S2 | Gustavo / Dev |
| ⬜ | Testar upload de fotos (se existir): formato, tamanho, preview | S2–3 | Gustavo / Dev |
| ⬜ | Validar que hostId é passado corretamente em todos os endpoints que exigem (ex: /properties) | S1 | Gustavo / Dev |

### 5A.4 Dashboard e Recomendação de Preço (KNN)

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Verificar se recomendação de preço exibe corretamente com imóvel real cadastrado | S2 | Gustavo |
| ⬜ | Adicionar estado de loading na tela de recomendação (evita tela em branco) | S2 | Gustavo / Dev |
| ⬜ | Revisar legibilidade dos dados: labels, unidades (R$/noite), gráficos | S2–3 | Gustavo / Dev |
| ⬜ | Tratar caso sem dados suficientes para recomendação — exibir mensagem clara ao usuário | S2–3 | Gustavo / Dev |
| ⬜ | Validar que 36.898 eventos do banco refletem em recomendações coerentes | S3 | Gustavo |

### 5A.5 Assinatura Stripe — Fluxo Real com Usuário

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Testar fluxo completo de assinatura em produção após KYC aprovado | S1–2 | Gustavo |
| ⬜ | Validar página de checkout Stripe: logo, nome do produto, valor correto | S2 | Gustavo |
| ⬜ | Testar cancelamento de assinatura — fluxo UI + atualização de status no sistema | S2 | Gustavo / Dev |
| ⬜ | Garantir que usuário sem assinatura vê CTA claro para assinar (não tela de erro) | S2 | Gustavo / Dev |
| ⬜ | Validar e-mail de confirmação de assinatura chegando corretamente | S2 | Gustavo |

### 5A.6 UX Geral e Responsividade

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Testar sistema completo em mobile (iOS e Android) — identificar quebras de layout | S1–2 | Gustavo |
| ⬜ | Corrigir problemas de responsividade críticos (bloqueiam uso no celular) | S2–3 | Gustavo / Dev |
| ⬜ | Revisar navegação: menu, breadcrumbs, botão de voltar — consistência em todas as telas | S2 | Gustavo / Dev |
| ⬜ | Auditar estados vazios (zero imóveis, zero dados) — exibir mensagem + CTA em vez de tela branca | S2–3 | Gustavo / Dev |
| ⬜ | Validar fluxo completo de ponta a ponta: cadastro → onboarding → imóvel → recomendação → assinatura | S3–4 | Gustavo |
| ⬜ | Documentar bugs restantes e priorizar backlog de produto | S4 | Gustavo |

---

## F5 — Presença Digital
**Objetivo:** Gerar demanda e visibilidade para o produto antes do go-live oficial.
**Período estimado:** Semanas 1–6 (21/03 → 30/04/2026)
**Custo estimado:** 💰 R$ 2.000–5.000/mês (mídia + produção)

### 5.1 Landing Page
**Meta:** Publicar landing page em urbanai.com.br convertendo anfitriões Airbnb em SP.

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Definir proposta de valor e copy principal com Rogério | S1 (21–28/03) | Gustavo + Rogério |
| ⬜ | Criar wireframe e estrutura de seções (hero, benefícios, preço, CTA, FAQ) | S1–2 | Gustavo |
| ⬜ | Desenvolver design e layout da landing page 💰 | S2–3 (31/03–11/04) | Gustavo / Dev |
| ⬜ | Publicar landing page em urbanai.com.br (após transferência do domínio) 💰 | S3–4 | Gustavo / Dev |
| ⬜ | Criar página de preços com CTA direto de assinatura (Stripe) | S3–4 | Gustavo / Dev |
| ⬜ | Configurar SEO básico: title, meta description, Open Graph, sitemap | S4 | Gustavo |
| ⬜ | Configurar Google Analytics 4 + Microsoft Clarity + Meta Pixel | S4 | Gustavo |
| ⬜ | Integrar formulário de pré-cadastro / lista de interesse | S3–4 | Gustavo / Dev |

### 5.2 Redes Sociais
**Meta:** Construir presença orgânica antes do lançamento pago.

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Criar conta Instagram @urbanai.oficial e LinkedIn Urban AI | S1 (21–28/03) | Gustavo |
| ⬜ | Definir identidade visual para redes (paleta, template de post) | S1–2 | Gustavo |
| ⬜ | Criar banco inicial: 12 posts sobre precificação Airbnb em SP 💰 | S2–4 | Gustavo |
| ⬜ | Iniciar publicação regular (2–3x por semana) 💰 | S4+ | Gustavo |

### 5.3 Tráfego Pago
**Meta:** Adquirir primeiros usuários pagantes via mídia.

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Aprovar orçamento mensal de mídia com Fabrício e Rogério 💰 | S1–2 | Gustavo + Sócios |
| ⬜ | Configurar Google Ads: busca "precificar airbnb são paulo" 💰 | S5–6 | Gustavo |
| ⬜ | Configurar Meta Ads: campanha para anfitriões Airbnb em SP 💰 | S5–6 | Gustavo |
| ⬜ | Monitorar KPIs: CAC, CTR, conversão landing → cadastro | S6+ | Gustavo |
| ⬜ | Otimizar campanhas semanalmente com base em dados 💰 | S8+ | Gustavo |

---

## F6 — Inteligência Artificial e Produto
**Objetivo:** Evoluir o motor KNN para dados reais e fortalecer o produto para retenção.
**Período estimado:** Semanas 3–10 (11/04 → 30/05/2026)
**Custo estimado:** 💰 Horas de desenvolvimento (a definir)

### 6.1 Motor KNN e Dados Reais

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Expor endpoints REST no backend para resultados do KNN 💰 | S3–4 | Gustavo / Dev |
| ⬜ | Integrar frontend: exibir sugestão de preço no dashboard do anfitrião 💰 | S4–6 | Gustavo / Dev |
| ⬜ | Conectar dados reais de propriedades cadastradas ao treinamento do KNN 💰 | S5–7 | Gustavo / Dev |
| ⬜ | Substituir dados mock por histórico real de preços e ocupação 💰 | S6–8 | Gustavo / Dev |
| ⬜ | Agendar retreinamento semanal do KNN (pós-scraping de eventos) | S8–9 | Gustavo / Dev |

### 6.2 Fontes de Dados e APIs

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Pesquisar novas fontes de eventos em SP (Sympla API, Prefeitura SP) | S3–4 | Gustavo |
| ⬜ | Avaliar e contratar API alternativa ou complementar ao RapidAPI/Airbnb | S4–5 | Gustavo |
| ⬜ | Reunião estratégica com PriceLabs — parceria ou benchmark | S4 | Gustavo |
| ⬜ | Ampliar cobertura dos spiders para novos bairros/regiões de SP | S6–8 | Gustavo / Dev |

### 6.3 Produto e Painel Administrativo

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Implementar painel admin básico: gestão de usuários + assinaturas 💰 | S6–9 | Gustavo / Dev |
| ⬜ | Criar fluxo de onboarding guiado para novos usuários 💰 | S7–9 | Gustavo / Dev |
| ⬜ | Configurar e-mails de onboarding automático via Mailersend 💰 | S6–8 | Gustavo / Dev |
| ⬜ | Implementar métricas de produto no dashboard (NPS, ativação, retenção) | S8–10 | Gustavo / Dev |

---

## F7 — Beta Fechado e Go-Live Oficial
**Objetivo:** Validar o produto com usuários reais e lançar oficialmente.
**Período estimado:** Semanas 8–14 (18/05 → 04/07/2026)
**Custo estimado:** 💰 Mídia no go-live + ajustes de produto

### 7.1 Beta Fechado

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Selecionar 5–10 anfitriões Airbnb em SP para beta (contato direto) | S7–8 | Gustavo |
| ⬜ | Integrar usuários beta gratuitamente — acompanhar onboarding | S8–9 | Gustavo |
| ⬜ | Coletar feedback estruturado (formulário + entrevistas curtas) | S9–10 | Gustavo |
| ⬜ | Priorizar e implementar correções críticas levantadas no beta | S10–12 | Gustavo / Dev |

### 7.2 Go-Live Oficial

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Checklist final de segurança e compliance antes do lançamento | S12 | Gustavo |
| ⬜ | Preparar comunicação de lançamento (e-mail, redes, press release) | S12–13 | Gustavo + Rogério |
| ⬜ | Anunciar lançamento oficial — Instagram, LinkedIn, e-mail para lista de interesse | S13–14 | Gustavo |
| ⬜ | Ativar campanhas de tráfego pago no go-live 💰 | S13–14 | Gustavo |
| ⬜ | Monitorar métricas de ativação e retenção nas primeiras 2 semanas | S14+ | Gustavo |

---

## Resumo de Custos Pós-Sprint

| Fase | Custo estimado | Quando |
|------|----------------|--------|
| F5 — Presença Digital | R$ 2.000–5.000/mês mídia + R$ 3.000–8.000 produção | A partir de S1 |
| F6 — IA e Produto | Horas de dev (a definir com equipe) | S3–10 |
| F7 — Beta e Go-Live | R$ 5.000–10.000 mídia no lançamento | S13–14 |
| Infraestrutura Railway | ~R$ 1.000/mês (já ativo) | Recorrente |
| Google Cloud | Grátis até 15/06/2026 (R$ 1.759 crédito) | — |
| AWS S3 | Grátis até esgotar (USD 200 crédito) | — |

> 💡 **Decisão urgente:** Aprovar orçamento de marketing com Fabrício e Rogério na Semana 1 — sem isso F5 não começa.

---

## Marcos Críticos — Próximas Semanas

| Quando | Marco | Impacto se atrasar |
|--------|-------|--------------------|
| Semana 1 | Submeter KYC Stripe | Cobranças reais bloqueadas — usuários não conseguem assinar |
| Semana 1 | Aprovar orçamento de marketing | F5 inteira bloqueada |
| Semana 1–2 | Transferências de domínio concluídas | Landing page não publica em urbanai.com.br |
| Semana 2–3 | Onboarding implementado + fluxo de cadastro corrigido (F5A) | Tráfego pago chegando num produto com problemas → churn alto |
| Semana 3–4 | Landing page no ar | Sem landing = sem conversão de tráfego pago |
| Semana 4 | Validação ponta a ponta concluída (F5A) | Não lançar tráfego pago antes de F5A estar aprovada |
| Semana 8 | Beta fechado iniciado | Atraso no go-live oficial |
| Semana 13–14 | Go-Live oficial | — |

---

## Estrutura de Relatórios ao Cliente

> Para os próximos sprints, os relatórios seguirão este ciclo:

| Frequência | Tipo | Conteúdo |
|------------|------|----------|
| Semanal | Status rápido (WhatsApp/Notion) | O que foi feito · O que está em andamento · Bloqueios |
| Quinzenal | Relatório de progresso (.docx) | KPIs da fase · Tarefas concluídas · Próximas 2 semanas |
| Por fase concluída | Relatório de entrega (.docx) | Resumo executivo · Entregas · Pontos abertos · Próxima fase |

---

*Urban AI © 2026 · Uso interno · Criado em 20/03/2026 · Versão pós-sprint*
