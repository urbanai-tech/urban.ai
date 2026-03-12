# Urban AI — Roadmap de Transição e Operação
**Versão 2.0 · Março 2026 · Sprint de 14 Dias + Fase de Crescimento**
D1 = 03/03/2026 · Hoje = Dia 9 (11/03/2026)

> **Meta principal:** Sistema rodando em infraestrutura própria (Railway + Supabase/MySQL), com todos os acessos transferidos e o produto estável — em 14 dias corridos.

---

## Legenda
- ✅ Concluído
- 🔄 Em andamento
- ⬜ Pendente
- 💰 Há custo envolvido

---

## F1 — Diagnóstico, Estudo e Documentação Completa
**Status: ✅ Concluído · Março 2026**

| Status | Tarefa | Resp. |
|--------|--------|-------|
| ✅ | Estudar todo o código-fonte, arquitetura e sistema recebido | Gustavo |
| ✅ | Entrevista técnica com equipe Lumina Lab (Felipe — Q&A completo) | Gustavo |
| ✅ | Criação de 32 documentos técnicos (PRD, ERD, APIs, arquitetura, etc.) | Gustavo |
| ✅ | Correção dos documentos com informações reais (on-premise, spiders semanais, KNN) | Gustavo |
| ✅ | Documento de Transferência de Contas (doc 32) — passo a passo detalhado | Gustavo |
| ✅ | Guia confidencial: como trabalhar com Fabrício e Rogério | Gustavo |
| ✅ | Identificação de riscos críticos: contas Lumina, KNN desintegrado, FastAPI depreciado | Gustavo |

---

## SPRINT 14 DIAS — F2 + F3 + F4 em paralelo

---

## F2 — Setup da Nova Infraestrutura Cloud
**Status: 🔄 Em andamento · D1–7 · 💰 R$1.000/mês**

| Status | Tarefa | Quando |
|--------|--------|--------|
| ✅ | Decisão final: Railway + MySQL + Upstash (Redis) | D1 |
| ✅ | Criar conta Railway em nome do Urban AI | D1 |
| ✅ | Provisionar servidor/container para o backend NestJS 💰 | D1–2 |
| ✅ | Provisionar banco MySQL gerenciado no Railway 💰 | D1–2 |
| ✅ | Configurar Upstash (Redis) para filas e cache 💰 | D1–2 |
| ✅ | Configurar variáveis de ambiente na nova infra | D2–3 |
| ✅ | Deploy do backend NestJS na nova infra | D3–4 |
| ✅ | Deploy do frontend Next.js na nova infra | D3–4 |
| ✅ | Deploy do KNN (Node.js/Express) na nova infra | D3–4 |
| ✅ | Deploy do Pipeline (Python/Prefect) na nova infra | D3–5 |
| ✅ | Deploy do Webscraping (Python/Scrapy) na nova infra | D3–5 |
| ✅ | Configurar CI/CD: deploy automático via git push (Railway) | D5–6 |
| ⬜ | Configurar alertas de billing na plataforma cloud 💰 | D2 |
| ⬜ | Solicitar dump do banco de dados (on-premise → nova infra) | D2–3 |
| ⬜ | Importar banco de dados para o MySQL da nova infra | D4–5 |
| ⬜ | Teste completo do sistema na nova infra antes de mudar DNS | D6–7 |

---

## F3 — Transferência de Contas Externas e DNS
**Status: 🔄 Em andamento · D1–10**

> Algumas transferências (Stripe, domínio) levam dias para processar. Iniciar no D1 mesmo que a infra ainda não esteja pronta.

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ⬜ | Obter acesso SSH ao servidor on-premise | D1 | Gustavo |
| ⬜ | Solicitar transferência do domínio urbanai.com.br com Lumina Lab | D1 | Gustavo |
| 🔄 | Criar conta Google corporativa (admin@urbanai.com.br) | D1 | Gustavo |
| 🔄 | Criar novo projeto Google Cloud: configurar OAuth 2.0 e Maps API | D1–2 | Gustavo |
| ✅ | Criar conta Mailersend Urban AI + configurar registros SPF e DKIM | D1–2 | Gustavo |
| ✅ | Iniciar nova conta Stripe em nome da Urban AI | D1 | Gustavo |
| ⬜ | Transferir domínio urbanai.com.br (Hostinger → conta Urban AI) | D2–3 | Gustavo+Lumina |
| ⬜ | Migrar credenciais RapidAPI (conta pessoal Fabrício → conta Urban AI) | D3–5 | Gustavo+Fabrício |
| ⬜ | Atualizar TODAS as variáveis de ambiente com as novas chaves | D7–8 | Gustavo |
| ⬜ | Redirecionar DNS para nova infraestrutura cloud (após testes F2) | D8–9 | Gustavo |
| ⬜ | Verificar certificado SSL após mudança de DNS | D9 | Gustavo |
| ⬜ | Revogar todos os acessos da Lumina Lab e rotacionar credenciais | D10 | Gustavo |

---

## F4 — Bugs, Segurança e Limpeza Técnica
**Status: ⬜ A iniciar · D5–14**

> O frontend foi refeito recentemente pela Lumina Lab — bugs em notificações e mensageria são esperados. Testar esses fluxos é prioridade imediata.

### 4.1 Bugs e Qualidade

| Status | Tarefa | Quando |
|--------|--------|--------|
| ⬜ | Testar fluxo de notificações (frontend refatorado — bugs esperados) | D5–7 |
| ⬜ | Testar fluxo de mensageria entre plataforma e anfitriões | D5–7 |
| ⬜ | Testar cadastro → assinatura → dashboard → recomendação (ponta a ponta) | D7–8 |
| ⬜ | Testar cancelamento de assinatura via Stripe webhook | D8 |
| ⬜ | Rodar os 7 spiders manualmente na nova infra e verificar dados coletados | D7–9 |
| ⬜ | Documentar todos os bugs encontrados e priorizar por gravidade | D8–9 |
| ⬜ | Corrigir bugs de alta prioridade (bloqueiam o usuário) | D9–14 |

### 4.2 Limpeza de Código

| Status | Tarefa | Quando |
|--------|--------|--------|
| ⬜ | Localizar e remover o FastAPI depreciado do codebase | D8–10 |
| ⬜ | Identificar e desativar o endpoint RapidAPI depreciado | D8 |
| ⬜ | Revisar e limpar variáveis de ambiente desnecessárias | D8 |

### 4.3 Segurança

| Status | Tarefa | Quando |
|--------|--------|--------|
| ✅ | HTTPS obrigatório (Railway force HTTPS automático) | D5 |
| ⬜ | Configurar firewall na nova infra: bloquear portas desnecessárias | D5–6 |
| ⬜ | Configurar backup automático do banco de dados (retenção mínima 7 dias) | D6–7 |
| ⬜ | Configurar monitoramento de uptime — UptimeRobot (gratuito) | D7 |
| ⬜ | Configurar Sentry para captura de erros em produção | D9–10 |
| ⬜ | Revisar permissões do banco de dados (usuário com mínimo de privilégios) | D10 |

---

## PÓS SPRINT — Fase de Crescimento e Go-Live
**A partir do Dia 15 — Ritmo acelerado, sem data rígida de deadline**

---

## F5 — Presença Digital: Landing Page, Redes Sociais e Tráfego Pago
**Status: ⬜ Pendente · D15–35 · 💰 R$2.000–5.000/mês mídia + produção**

### 5.1 Landing Page

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ⬜ | Definir copy e proposta de valor clara para anfitriões Airbnb em SP | D15–17 | Gustavo+Rogério |
| ⬜ | Criar design da landing page (Framer, Webflow ou dev) 💰 | D16–20 | Gustavo |
| ⬜ | Desenvolver e publicar landing page em urbanai.com.br 💰 | D20–24 | Gustavo/Dev |
| ⬜ | Criar página de preços com CTA de assinatura | D22–24 | Gustavo |
| ⬜ | Configurar SEO básico: title, meta description, Open Graph | D24 | Gustavo |
| ⬜ | Configurar Google Analytics 4, Microsoft Clarity e Meta Pixel | D23–24 | Gustavo |
| ⬜ | Integrar formulário de interesse / pré-cadastro | D22–24 | Gustavo |

### 5.2 Redes Sociais

| Status | Tarefa | Quando |
|--------|--------|--------|
| ⬜ | Criar/Configurar conta Instagram e LinkedIn do Urban AI | D15 |
| ⬜ | Criar banco de conteúdo inicial: 12 posts sobre precificação Airbnb em SP 💰 | D15–22 |
| ⬜ | Publicar regularmente (2–3x por semana) 💰 | D22+ |

### 5.3 Tráfego Pago

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ⬜ | Definir e aprovar orçamento mensal de mídia 💰 | D15 | Gustavo+Fabrício+Rogério |
| ⬜ | Configurar Google Ads: busca 'precificar airbnb são paulo' 💰 | D25–28 | Gustavo |
| ⬜ | Configurar Meta Ads: campanha para anfitriões Airbnb em SP 💰 | D25–28 | Gustavo |
| ⬜ | Monitorar KPIs: CAC, CTR, conversão landing → cadastro | D28+ | Gustavo |
| ⬜ | Otimizar campanhas semanalmente com base em dados 💰 | D35+ | Gustavo |

---

## F6 — Inteligência Artificial, KNN Integrado e Novas APIs
**Status: ⬜ Pendente · D15–35 · 💰 Custo de desenvolvimento**

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ⬜ | Expor endpoints REST no backend para resultados do motor KNN 💰 | D15–20 | Gustavo/Dev |
| ⬜ | Integrar frontend: exibir sugestão de preço no dashboard do anfitrião 💰 | D20–25 | Gustavo/Dev |
| ⬜ | Conectar dados reais de propriedades cadastradas ao treinamento do KNN 💰 | D22–28 | Gustavo/Dev |
| ⬜ | Substituir dados mock por histórico real de preços e ocupação 💰 | D25–30 | Gustavo/Dev |
| ⬜ | Agendar retreinamento semanal do KNN (após scraping dos eventos) | D28–30 | Gustavo/Dev |
| ⬜ | Corrigir/substituir o endpoint RapidAPI depreciado por nova fonte de dados | D15–20 | Gustavo/Dev |
| ⬜ | Pesquisar novas fontes de dados de eventos em SP (Sympla API, Prefeitura) | D20–25 | Gustavo |
| ⬜ | Explorar parceria com PriceLabs — reunião estratégica | D20 | Gustavo |
| ⬜ | Implementar painel administrativo básico (sem depender do Stripe para tudo) 💰 | D28–35 | Gustavo/Dev |

---

## F7 — Testes, Beta e Go-Live Oficial
**Status: ⬜ Pendente · D28–42**

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ⬜ | Beta fechado: 5–10 anfitriões reais usando gratuitamente por 1 semana | D28–35 | Gustavo |
| ⬜ | Coletar feedback do beta e priorizar correções urgentes | D35–38 | Gustavo |
| ⬜ | Implementar melhorias críticas levantadas no beta | D38–42 | Gustavo/Dev |
| ⬜ | Configurar onboarding automático: e-mails de boas-vindas via Mailersend | D30–35 | Gustavo/Dev |
| ⬜ | Checklist final de segurança antes do lançamento | D40 | Gustavo |
| ⬜ | Anunciar lançamento oficial (Instagram, LinkedIn, e-mail para lista de interesse) | D42 | Gustavo |
| ⬜ | Ativar campanhas de tráfego pago no go-live 💰 | D42 | Gustavo |
| ⬜ | Monitorar métricas de ativação e retenção nas primeiras 2 semanas pós-lançamento | D42+ | Gustavo |

---

## Resumo Executivo de Custos

| Fase | Custo | Status |
|------|-------|--------|
| F1 — Diagnóstico | Sem custo | ✅ OK |
| F2 — Infra Cloud | R$1.000/mês (definido) | 🔄 |
| F3 — Contas & DNS | Sem custo direto | 🔄 |
| F4 — Bugs & Segurança | Hora dev (variável) | ⬜ |
| F5 — Marketing | R$2k–5k/mês mídia + produção | ⬜ |
| F6 — IA & APIs | Custo de dev (a definir) | ⬜ |
| F7 — Go-Live | Mídia no go-live | ⬜ |

---

## Marcos Críticos — Decisões que Não Podem Esperar

| Quando | Decisão | Impacto se atrasar |
|--------|---------|-------------------|
| ~~Antes D1~~ ✅ | Escolha da plataforma cloud (Railway + MySQL) | ~~Toda F2 bloqueada~~ |
| D1 | Acesso SSH ao servidor on-premise | Dump do banco bloqueado |
| D1 | Criar conta corporativa Google para Urban AI | OAuth e Maps API bloqueados |
| D2 | Solicitar dump do banco | Migração de dados atrasa D4–5 |
| D7 | Sistema testado na nova infra antes de mudar DNS | Risco de downtime para usuários |
| D15 | Aprovar orçamento de marketing com Fabrício e Rogério | F5 não pode começar sem aprovação |

---

*Urban AI © 2026 · Uso interno · Atualizado em 11/03/2026 (Dia 9)*
