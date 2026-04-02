# Urban AI — Roadmap de Transição e Operação
**Versão 2.0 · Março 2026 · Sprint de 14 Dias + Fase de Crescimento**
D1 = 03/03/2026 · Hoje = Dia 12 (18/03/2026)

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
| ✅ | Configurar alertas de billing na plataforma cloud 💰 | D8 |
| ✅ | Configurar backup automático MySQL — Railway Pro Plan ativo | D8 |
| ✅ | Criar bucket S3 (urbanai-data-lake, sa-east-1) + IAM user urban-ai-scrapy | D8 |
| ✅ | Google Cloud Platform: Maps API + OAuth 2.0 + R$1.759 crédito gratuito | D8 |
| ✅ | Solicitar dump do banco de dados (on-premise → nova infra) | D11 |
| ✅ | Importar banco de dados para o MySQL da nova infra | D11 |
| ✅ | Teste completo do sistema na nova infra antes de mudar DNS (T1–T7 executados) | D12 |

---

## F3 — Transferência de Contas Externas e DNS
**Status: 🔄 Em andamento · D1–10**

> Algumas transferências (Stripe, domínio) levam dias para processar. Iniciar no D1 mesmo que a infra ainda não esteja pronta.

| Status | Tarefa | Quando | Resp. |
|--------|--------|--------|-------|
| ✅ | Obter acesso SSH ao servidor on-premise | D11 | Gustavo+Lumina |
| ✅ | Solicitar transferência do domínio urbanai.com.br com Lumina Lab | D11 | Gustavo+Lumina |
| ✅ | Criar conta Google corporativa (urbanai.admin@gmail.com) | D8 | Gustavo |
| ✅ | Criar novo projeto Google Cloud: configurar OAuth 2.0 e Maps API | D8 | Gustavo |
| ✅ | Criar conta Mailersend Urban AI + configurar registros SPF e DKIM | D1–2 | Gustavo |
| ✅ | Iniciar nova conta Stripe em nome da Urban AI | D1 | Gustavo |
| ✅ | Criar conta RapidAPI Urban AI + migrar assinaturas Fabrício | D11 | Gustavo |
| ✅ | Atualizar TODAS as variáveis de ambiente com as novas chaves | D8 | Gustavo |
| ✅ | Configurar Sentry (backend NestJS + frontend Next.js) | D8 | Gustavo |
| ✅ | Configurar DNS myurbanai.com — app.myurbanai.com apontando para Railway | D8 | Gustavo |
| ✅ | Apontamento temporário urbanai.com.br feito pela Lumina Lab | D11 | Lumina Lab |
| 🔄 | Transferência formal domínio urbanai.com.br (em processamento) | D13+ | Gustavo+Lumina |
| 🔄 | Lumina Lab concluir transferência do domínio myurbanai.com para Urban AI | D13+ | Lumina Lab |
| ✅ | Verificar certificado SSL após configuração DNS — todos os domínios validados | D13 | Gustavo |
| ✅ | Revogar todos os acessos da Lumina Lab e rotacionar credenciais | D13 | Gustavo |

---

## F4 — Bugs, Segurança e Limpeza Técnica
**Status: 🔄 Em andamento · D5–14**

> Testes executados em D12 por agente automatizado. 5/7 aprovados, 2 parciais (sem impacto em produção).

### 4.1 Bugs e Qualidade

| Status | Tarefa | Quando |
|--------|--------|--------|
| ✅ | T1 — Testar cadastro, login JWT, rotas protegidas e forgot-password | D12 |
| ✅ | T2 — Testar assinatura Stripe (modo teste) + webhook — aprovado após corrigir chaves | D12 |
| ✅ | T3 — Testar dashboard e KNN (36.898 eventos, /properties requer hostId por design) | D12 |
| ✅ | T4 — Testar spiders Scrapyd + S3: porta 6800 corrigida, Prefect serve.py com cron 03h UTC | D12 |
| ✅ | T5 — Testar notificações: /health criada, /notifications OK | D12 |
| ✅ | T6 — Testar Sentry: /debug/sentry-test criada, captura validada no painel | D12 |
| ✅ | T7 — DNS/SSL: app.myurbanai.com ✅ · urbanai.com.br ✅ · notify.myurbanai.com SPF/DKIM ✅ | D13 |
| ✅ | Testar fluxo completo de mensageria entre plataforma e anfitriões | D13 |
| ✅ | Configurar DNS raiz myurbanai.com + Mailersend SPF/DKIM no Hostinger | D13 |

### 4.2 Stripe — Ativação de Cobranças Reais 💰

> Para que o Stripe processe cobranças reais e transfira valores para a conta bancária da Urban AI, é obrigatório concluir o processo KYC (Know Your Customer) da plataforma.

| Status | Tarefa | Resp. |
|--------|--------|-------|
| ⬜ | Reunir documentos dos sócios majoritários: RG/CPF + comprovante de residência | Gustavo+Sócios |
| ⬜ | Obter contrato social da Urban AI (ou equivalente: ato constitutivo / registro) | Gustavo |
| ⬜ | Preencher cadastro de negócio no Stripe Dashboard (CNPJ, endereço, tipo de empresa) | Gustavo |
| ⬜ | Submeter documentação dos sócios majoritários para verificação Stripe | Gustavo |
| ⬜ | Informar dados bancários da empresa para recebimento de repasses (conta PJ) | Gustavo |
| ⬜ | Aguardar aprovação Stripe (geralmente 1–3 dias úteis) | Gustavo |
| ⬜ | Validar primeiro repasse em ambiente de produção após aprovação | Gustavo |

### 4.3 Limpeza de Código

| Status | Tarefa | Quando |
|--------|--------|--------|
| ✅ | FastAPI depreciado — não encontrado no codebase, já removido | D8 |
| ✅ | Identificar e substituir chave RapidAPI depreciada (Fabrício) por conta Urban AI | D8 |
| ✅ | Revisar e limpar variáveis de ambiente (HERE Maps removido, chaves antigas trocadas) | D8 |

### 4.4 Segurança

| Status | Tarefa | Quando |
|--------|--------|--------|
| ✅ | HTTPS obrigatório (Railway force HTTPS automático) | D5 |
| ✅ | Configurar firewall na nova infra: portas internas bloqueadas (Railway Networking) | D8 |
| ✅ | Configurar backup automático do banco de dados (Railway Pro — retenção 7 dias) | D8 |
| ✅ | Configurar monitoramento de uptime — UptimeRobot | D8 |
| ✅ | Configurar Sentry para captura de erros em produção | D8 |
| ✅ | Revisar permissões do banco de dados (usuário urbanai_app criado) | D11 |
| ✅ | JWT_SECRET rotacionado — hash 128 chars via Railway MCP | D13 |
| ✅ | Mailersend: templates externos removidos, HTML nativo no backend | D13 |
| ✅ | Variáveis de ambiente limpas — chaves Lumina deletadas, EMAIL_SENDER atualizado | D13 |
| ✅ | AWS S3: Block Public Access ON · IAM limitado estritamente ao S3 | D13 |
| ✅ | Checklist final de segurança 7/7 aprovado — sistema auditado para go-live | D13 |

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

*Urban AI © 2026 · Uso interno · Atualizado em 20/03/2026 (Dia 14 — Sprint encerrado ✅ · Sistema entregue e operacional)*
