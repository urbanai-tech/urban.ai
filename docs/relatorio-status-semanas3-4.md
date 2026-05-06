# Urban AI — Relatório de Status · Semanas 3–4
**Data:** 13/04/2026 | **Responsável:** Gustavo Macedo | **Sprint base:** Migração 14 dias (enc. 20/03/2026)

> O sprint de migração foi concluído com 53 entregas. Sistema 100% operacional sob controle Urban AI. Este relatório cobre o status atual das fases pós-sprint.

---

## KPIs do Período

| Entregues (F5 + F5A + F5C + F6 + F7) | Em Andamento | Pendentes | Bloqueantes |
|:---:|:---:|:---:|:---:|
| **67** | **6** | **6** | **2** |

---

## Progresso por Fase

| Fase | Progresso |
|------|-----------|
| Pendências em Aberto (Carryover) | 0% |
| F5A — Validação de Produto e UX | 60% |
| F5C — Segurança e Hardening | **100% ✅** |
| F5 — Presença Digital | 85% |
| F6 — IA e Produto | 52% |
| F7 — Beta e Go-Live | 10% |

---

## 🔴 BLOQUEANTES — Requer Atenção Imediata

| Item | Impacto | Prazo |
|------|---------|-------|
| **Aprovação do orçamento de marketing (F5.4)** | Bloqueia F5.3 inteira (tráfego pago) | Semana 4 — URGENTE |
| **KYC Stripe — submissão de documentos** | Cobranças reais bloqueadas — usuário não consegue assinar | Semana 1 — em andamento |

---

## Pendências em Aberto (Carryover do Sprint)

| Status | Item | Prazo | Resp. |
|--------|------|-------|-------|
| 🔄 | **KYC Stripe** — submeter RG/CPF dos sócios + contrato social + conta PJ. Aprovação em 1–3 dias úteis. Desbloqueia cobranças reais. | S1 | Gustavo |
| 🔄 | **Transferência domínio urbanai.com.br** — processo formal com Lumina Lab. Apontamento temporário já ativo. | 2–5 dias | Gustavo + Lumina |
| 🔄 | **Transferência domínio myurbanai.com** — aguardando Lumina Lab. Sistema já operando via app.myurbanai.com. | 2–5 dias | Lumina Lab |

---

## F5A — Validação de Produto, UX e Fluxos Reais

**Período:** Semanas 1–4 (21/03 → 18/04/2026) — paralelo à F5  
**Prioridade:** 🔴 Alta — problemas identificados no sprint bloqueiam retenção de usuários

### 5A.1 Cadastro e Autenticação — UX e Erros

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Mapear todos os erros de formulário sem feedback visual (campos obrigatórios, formato inválido) | S1 | Gustavo |
| ⬜ | Corrigir mensagens de erro genéricas — substituir por mensagens claras e acionáveis | S1–2 | Gustavo/Dev |
| ⬜ | Revisar estados dos botões: loading, disabled, sucesso e erro em todos os CTAs | S1–2 | Gustavo/Dev |
| ⬜ | Corrigir fluxo de confirmação de e-mail — garantir que link chega e redireciona corretamente | S1–2 | Gustavo/Dev |
| ✅ | Revisar fluxo de recuperação de senha + Global Paywall Modal — popup opaco sobre a tela (sem redirect), aplicado em /dashboard, /maps e /properties (commit 4338591) | S2 | Gustavo/Dev |
| ✅ | Interceptor 401 global — limpa token e redireciona para login automaticamente em qualquer rota protegida (commit cd7ba41) | S2 | Gustavo/Dev |
| ✅ | Fix URL de atualização de perfil — removido trailing userId duplicado no endpoint (commit 307024e) | S2 | Gustavo/Dev |
| ✅ | Armazenar airbnbHostId no perfil do usuário — base para enrichment automático futuro (commits 7f710de + 55c1a8d) | S2 | Gustavo/Dev |
| ⬜ | Testar login com Google OAuth — cobrir edge cases (conta já existente, e-mail diferente) | S2 | Gustavo/Dev |

### 5A.2 Onboarding — Criação do Fluxo

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Definir jornada do onboarding: etapas, ordem, obrigatório vs. opcional | S1 | Gustavo |
| ✅ | Wizard de onboarding 5 passos: boas-vindas, link Airbnb, seleção de imóveis, config IA, paywall Stripe integrado (commit eccf56c) | S2 | Gustavo/Dev |
| ✅ | Criar nova rota de usuários (/profile/) e boas-vindas pós-cadastro com próximos passos (commit 701babe) | S2 | Gustavo/Dev |
| ✅ | Geocoding no card do onboarding — exibe endereço completo do imóvel ao importar via link Airbnb (commits e5ea7fd + a6e8570) | S2 | Gustavo/Dev |
| ⬜ | Implementar checklist de setup do perfil (foto, nome, primeiro imóvel) — tela em /profile/ | S2–3 | Gustavo/Dev |
| ⬜ | Criar tooltip/guia contextual na primeira visita ao dashboard | S3 | Gustavo/Dev |
| ✅ | Criar sequência de e-mails de onboarding (D1/D3/D7) — templates HTML prontos para Mailersend, triggers D+0/D+3/D+7, exit condition `recommendation_approved` | S2–3 | Gustavo |
| ⬜ | Integrar sequência D1/D3/D7 no Mailersend (conectar ao evento de registro) 💰 | S3 | Gustavo/Dev |
| ⬜ | Testar onboarding completo com 2–3 usuários internos e coletar feedback | S3–4 | Gustavo |
| ✅ | Fix: salvar corretamente pricingStrategy e operationMode no perfil do usuário (backend) — dados de configuração de IA persistidos via PATCH /profile (commit bf6f970) | S3 | Gustavo/Dev |
| ✅ | Fix 404: limites percentuais (percentualBounds) persistidos via atualização de perfil — rota correta mapeada (commit 5c65b46) | S3 | Gustavo/Dev |
| ✅ | Botão de avanço quando todos imóveis já cadastrados no onboarding + criação da rota /lancamento/page.tsx (commit 3107496) | S3 | Gustavo/Dev |

### 5A.3 Cadastro de Imóveis — Fluxo e Validações

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Auditar formulário de cadastro de imóvel: campos, ordem, clareza dos labels | S1 | Gustavo |
| ⬜ | Corrigir campos obrigatórios sem validação + mensagens de erro ausentes nos formulários | S1–2 | Gustavo/Dev |
| ✅ | Modal nativo "Adicionar Propriedade" em /properties — sem redirect para /onboarding, abre inline com lógica de link Airbnb ou Host ID (commit a0816f3) | S2 | Gustavo/Dev |
| ✅ | Remover botão "Adicionar" redundante da Sidebar — simplifica navegação (commit a0816f3) | S2 | Gustavo/Dev |
| ✅ | Filtro de duplicatas na importação — filtra imóveis já cadastrados para evitar registros duplicados (commit f449c04) | S2 | Gustavo/Dev |
| ✅ | Dialog de confirmação antes de deletar propriedade — previne deleção acidental (commit 00c45dc) | S2 | Gustavo/Dev |
| ✅ | Dados enriquecidos nos cards de importação: quartos, camas, rating, endereço completo, amenities (commits 3f82694 + ddbdad4) | S2 | Gustavo/Dev |
| ✅ | Links clicáveis nos cards de propriedade — link do anúncio no Airbnb + perfil do anfitrião (commit 3c52fd6) | S2 | Gustavo/Dev |
| ✅ | Substituição do RapidAPI por scraping direto via GraphQL Airbnb — .com.br + fallback intl + decode Base64 Relay + cron mensal re-scraping (commits 135dc46, 7555609, 130cee0) | S2–3 | Gustavo/Dev |
| ✅ | Validação explícita de hostId no scraper — previne false-positives na listagem (commit 192db9f) | S1 | Gustavo/Dev |
| ✅ | id_do_anuncio incluído no payload findPropertiesForDropdown (commit 04553b9) | S2 | Gustavo/Dev |
| ⬜ | Testar upload de fotos: formato, tamanho, preview | S2–3 | Gustavo/Dev |

### 5A.4 Dashboard e Recomendação de Preço (KNN)

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Verificar se recomendação de preço exibe corretamente com imóvel real cadastrado | S2 | Gustavo |
| ⬜ | Adicionar estado de loading na tela de recomendação (evita tela em branco) | S2 | Gustavo/Dev |
| ⬜ | Revisar legibilidade dos dados: labels, unidades (R$/noite), gráficos | S2–3 | Gustavo/Dev |
| ⬜ | Tratar caso sem dados suficientes para recomendação — exibir mensagem clara | S2–3 | Gustavo/Dev |
| ⬜ | Validar que 36.898 eventos do banco refletem em recomendações coerentes | S3 | Gustavo |
| ✅ | Campos de configuração do motor de IA adicionados na página de configurações/event-log — operationMode, pricingStrategy, percentualBounds visíveis pelo usuário (commit 0db7456) | S3 | Gustavo/Dev |
| ✅ | Fix TypeScript: valor nulo aceito no campo de ajuste percentual final da estratégia autônoma — previne erro de tipagem (commit 30707b7) | S3 | Gustavo/Dev |
| ✅ | Remover endpoints de percentual depreciados do event-log — limpeza de rotas obsoletas (commit 018ded5) | S3 | Gustavo/Dev |

### 5A.5 Assinatura Stripe — Fluxo Real

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Stripe webhook aprimorado + MailerSend HTML: templates pixel-perfect para e-mails de verificação, reset, análise e notificações (commit 3775c40) | S2 | Gustavo/Dev |
| ✅ | Global Paywall Modal — popup sem redirect, usuários sem plano veem CTA direto na tela (commit 4338591) | S2 | Gustavo/Dev |
| ⬜ | Testar fluxo completo de assinatura em produção após KYC aprovado | S1–2 | Gustavo |
| ⬜ | Validar página de checkout Stripe: logo, nome do produto, valor correto | S2 | Gustavo |
| ⬜ | Testar cancelamento de assinatura — fluxo UI + atualização de status no sistema | S2 | Gustavo/Dev |
| ⬜ | Validar e-mail de confirmação de assinatura chegando corretamente | S2 | Gustavo |
| ✅ | Planos migrados para entidades dinâmicas no banco de dados — Plans entity no frontend e backend, fim de planos hardcoded (commit 48aeda8) | S3 | Gustavo/Dev |
| ✅ | Cobrança anual implementada: toggle mensal/anual no onboarding e GlobalPaywallModal, flag billingCycle no Stripe, IDs de preço separados por ciclo (commit 47b5443) | S3 | Gustavo/Dev |

### 5A.6 UX Geral e Responsividade

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Testar sistema completo em mobile (iOS e Android) — identificar quebras de layout restantes | S1–2 | Gustavo |
| ✅ | Fix layout responsivo do badge de recomendação — corrigido estouro em telas menores (commit 3a46297) | S2 | Gustavo/Dev |
| ✅ | AlertDialog implementado em ações destrutivas + cards "Em Breve" desabilitados + fix Suspense error useSearchParams Next.js (commit e815e97) | S2 | Gustavo/Dev |
| ✅ | Traduções PT-BR expandidas: labels, amenidades, siglas de estado (SP, RJ), emojis revisados (commits 2d56d1c + 134b5a5) | S2 | Gustavo/Dev |
| ⬜ | Revisar navegação: menu, breadcrumbs, botão de voltar — consistência em todas as telas | S2 | Gustavo/Dev |
| ✅ | UX Copy completo do dashboard — 12 telas cobertas (zero imóveis, sem recomendações, calibrando modelo, loading, erros, toasts, confirmações destrutivas, onboarding checklist) + glossário padronizado de termos (Aprovar/Ignorar/Preço base/Evento detectado) | S2–3 | Gustavo |
| 🔄 | Validar fluxo completo de ponta a ponta: cadastro → onboarding → imóvel → recomendação → assinatura — cadastro/onboarding/imóvel validados, falta recomendação e assinatura | S3–4 | Gustavo |
| ⬜ | Documentar bugs restantes e priorizar backlog de produto | S4 | Gustavo |

---

## F5C — Segurança e Hardening ✅ 100% Concluída

**Período:** 24/04/2026 (sprint dedicado)  
Todos os 7 riscos críticos da auditoria de segurança resolvidos antes do go-live com clientes reais.

### 5C.1 Criptografia e Autenticação

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | SHA-256 → bcrypt(12): hash antigo era reversível em milissegundos com rainbow tables. Rehash lazy no próximo login sem reset forçado (commit f960825) | S4 | Gustavo/Dev |
| ✅ | JWT_SECRET via env — era hardcoded `"mysecretkey"` no código. Agora via ConfigService; backend recusa boot se ausente. TTL: 12h → 15min (commit d1c1bc1) | S4 | Gustavo/Dev |
| ✅ | httpOnly cookies + refresh token rotation — JWT saiu do localStorage (vulnerável a XSS). Backend pronto; migração frontend documentada em runbooks/ (commit d1c1bc1) | S4 | Gustavo/Dev |

### 5C.2 Hardening da Infraestrutura

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | CORS whitelist + throttler + helmet+CSP: removido `*` do CORS (fail-closed), rate limiting 5 req/min no auth (brute-force bloqueado), headers HTTP protegidos (commit 2430ffb) | S4 | Gustavo/Dev |
| ✅ | TypeORM `synchronize:true` → migrations versionadas: modo synchronize podia destruir a estrutura do banco em qualquer deploy (commit cfc1bc4) | S4 | Gustavo/Dev |
| ✅ | IP hardcoded removido + Dockerfile duplicado deletado. Chave RapidAPI movida do código-fonte para variável de ambiente (commits 9cbf053 + 890ae85) | S4 | Gustavo/Dev |
| ✅ | `console.log` que vazava senhas, JWTs e headers em produção removido — risco de exposição de credenciais em logs eliminado (commit 6d1d9c5) | S4 | Gustavo/Dev |

### 5C.3 Ambiente e Runbooks

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | `.env.example` para todos os serviços (backend, frontend, KNN, scraping) + `.gitignore` fortalecido + logs/dumps purgados do git (commits f1bdfd4 + 22434e2) | S4 | Gustavo/Dev |
| ✅ | `APP_ENV` para distinguir staging de produção. Runbooks: operação, acessos, incidentes (commits 19a1378 + b4fd7ea) | S4 | Gustavo/Dev |
| ✅ | 5 ADRs retroativos documentados (NestJS, KNN, Prefect, MySQL, Railway) + LGPD + SLO + k6 load tests + WCAG (commit 62357ca) | S4 | Gustavo/Dev |

### 5C.4 Cobertura de Testes — de zero para 84 testes

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Suíte inicial: auth.service (5 casos), knn-classifier (6 casos) + Playwright smoke no frontend + CI configurado (commit a6bc320) | S4 | Gustavo/Dev |
| ✅ | Specs do UrbanAIPricingEngine + Stripe webhook handler (commit 2d6b3a6) | S4 | Gustavo/Dev |
| ✅ | Cobertura expandida para 84 testes: plans.service, payments.service, checkout anual, cancelamento, JWT strategy (commit 604141e) | S4 | Gustavo/Dev |

---

## F5 — Presença Digital

**Período:** Semanas 1–6 (21/03 → 30/04/2026)  
**Custo estimado:** 💰 R$ 2.000–5.000/mês (mídia + produção)

### 5.1 Landing Page

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Definir proposta de valor e copy principal — narrativa "Síndrome da Casa Barata" + dossiê executivo | S1 | Gustavo |
| ✅ | Criar wireframe e estrutura de seções (hero, benefícios, preço, CTA, FAQ) | S1–2 | Gustavo |
| ✅ | Desenvolver design e layout da landing page — Glassmorphism Premium (HTML) | S2–3 | Gustavo/Dev |
| ✅ | Criar página de preços com CTA direto de assinatura (Stripe) — 2 planos incluídos | S3–4 | Gustavo/Dev |
| ✅ | Configurar SEO básico: meta tags completas, OG, Twitter Card, JSON-LD (SoftwareApplication + Offer nos 2 planos), canonical URL | S4 | Gustavo |
| ✅ | Criar sitemap.xml (4 páginas) + robots.txt (bloqueando /app/, /api/, /admin/) | S4 | Gustavo |
| ✅ | Páginas institucionais criadas: Sobre, Contato, Privacidade — com layout e identidade visual Urban AI (commit beba9cc) | S3 | Gustavo/Dev |
| ✅ | Google Analytics 4 + Meta Pixel ativos em /lancamento + formulário de waitlist funcionando — rastreamento real ativo (commit f7a114c) | S4 | Gustavo/Dev |
| ⬜ | Publicar landing page em urbanai.com.br (aguarda transferência do domínio) 💰 | S4–5 | Gustavo/Dev |
| ⬜ | Integrar formulário de pré-cadastro / lista de interesse | S4–5 | Gustavo/Dev |
| ✅ | Rota /lancamento/page.tsx criada no app — página de lançamento integrada ao Next.js (commit 3107496) | S3 | Gustavo/Dev |

### 5.2 Redes Sociais

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| 🔄 | Criar contas nas redes sociais — Instagram @urbanai.oficial já criado, aguarda criação de LinkedIn e Facebook | S1 | Gustavo |
| ✅ | Definir identidade visual para redes — brand book com 6 templates HTML (A–F: Editorial, Guia, Dashboard, Contraste, Prova Social, Checklist) | S1–2 | Gustavo |
| ✅ | Criar press release de lançamento + email HTML de lançamento (3 subject lines A/B, cards dos 2 planos com preços) | S2 | Gustavo |
| ✅ | Posts 01–02: carrossel reflexão B2B (3 slides) + post de lançamento Urban AI (squad run 06/04) | S2 | Gustavo |
| ✅ | Posts 03–12: 8 posts adicionais HTML — Checklist (F), Contraste (D), Editorial (A), Guia (B) — ADR, RevPAR, feriados, eventos SP, glossário | S3–4 | Gustavo |
| ✅ | Criar bios de redes sociais — Instagram (3 variações A/B/C), LinkedIn About completo, Twitter/X reservado | S4 | Gustavo |
| ✅ | Criar calendário editorial 4 semanas — 3 posts/semana, arco narrativo por semana, captions por template, banco de hashtags em tiers | S4 | Gustavo |
| ⬜ | Iniciar publicação regular (requer conta Instagram/LinkedIn criada primeiro) 💰 | S5+ | Gustavo |

### 5.3 Tráfego Pago

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| 🔴 | **Aprovar orçamento completo de recursos (ver 5.4)** com Fabrício e Rogério 💰 | S4 | Gustavo + Sócios |
| ⬜ | Configurar Google Ads: busca "precificar airbnb são paulo" 💰 | S5–6 | Gustavo |
| ⬜ | Configurar Meta Ads: campanha para anfitriões Airbnb em SP 💰 | S5–6 | Gustavo |
| ⬜ | Monitorar KPIs: CAC, CTR, conversão landing → cadastro | S6+ | Gustavo |
| ⬜ | Otimizar campanhas semanalmente com base em dados 💰 | S8+ | Gustavo |

### 5.4 Aprovação de Recursos — Tabela de Investimentos em Marketing

**Status: 🔴 Aguarda aprovação dos sócios — bloqueia F5.3 inteira**

> ⚠️ Nenhuma campanha paga ou contratação deve ser iniciada sem aprovação formal por Fabrício e Rogério.

| Serviço | Fornecedor | Faixa Mensal | Prazo | Status |
|---------|-----------|-------------|-------|--------|
| Gestão de Tráfego Pago (Google + Meta) | Urban AI 💰 | R$ 1.500–R$ 2.500 | S4 | ⬜ Aguarda aprovação |
| Verba de Mídia (investimento direto em anúncios) | Google / Meta | R$ 1.500–R$ 3.000 | S4 | ⬜ Aguarda aprovação |
| Design de Posts (8–12 posts/mês, feed + stories) | Parceiro Urban AI 💰 | R$ 800–R$ 1.500 | S4 | ⬜ Aguarda aprovação |
| Produção de Vídeos/Reels com IA | Urban AI + Ferramenta 💰 | R$ 500–R$ 1.000 | S4 | ⬜ Aguarda aprovação |
| Ferramenta IA Vídeo (CapCut Pro ou HeyGen) | Assinatura | R$ 40–R$ 170 | S4 | ⬜ Aguarda aprovação |
| **Total estimado** | | **R$ 4.340–R$ 8.170/mês** | | 🔴 Bloqueado |

**Referências de mercado (abril 2026):**
- Gestão de tráfego (freelancer intermediário a agência): R$ 1.500–R$ 8.000/mês
- Design social media (8–12 posts/mês): R$ 500–R$ 2.500/mês
- CapCut Pro: ~R$ 40/mês | HeyGen Creator: US$29/mês (~R$ 165/mês)
- Verba de mídia: validar canais com R$ 1.500–R$ 3.000/mês antes de escalar

> 💡 Recomendação: iniciar na faixa conservadora (R$ 4.340/mês). Escalar após validação de CAC e ROAS nas primeiras 4 semanas.

---

## F6 — Inteligência Artificial e Produto

**Período:** Semanas 3–10 (11/04 → 30/05/2026)  
**Custo estimado:** 💰 Horas de desenvolvimento (a definir)

### 6.1 Motor KNN e Evolução do Modelo

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Expor endpoints REST no backend para resultados do KNN | S3–4 | Gustavo/Dev |
| ✅ | Modo autônomo de precificação guiado por IA no frontend e backend | S4–6 | Gustavo/Dev |
| ✅ | Strategy pattern plugável: RuleBasedPricingStrategy (Tier 0) + XGBoostPricingStrategy (skeleton) + ShadowPricingStrategy (dual-run). Troca via env var sem deploy. ADR 0008 documenta migração KNN→XGBoost (commit 593d846) | S5 | Gustavo/Dev |
| ✅ | AdaptivePricingStrategy: auto-tier que escolhe modelo conforme dataset cresce (Tier 0→2→4) sem necessidade de deploy entre tiers (commit 54a1da1) | S5 | Gustavo/Dev |
| ✅ | Captura passiva de dataset próprio em 3 frentes: cron diário 03:30 BRT (snapshot todos os imóveis), comps persistidos a cada análise (~10–30 pontos/análise), ground truth via Stays. Dataset acumulando desde 25/04 (commit 54a1da1) | S5 | Gustavo/Dev |
| ✅ | Cron de retreinamento ativo — DatasetCollectorService + PricingBootstrapService no boot (commit 54a1da1) | S5 | Gustavo/Dev |
| 🔄 | Conectar dataset acumulado ao treinamento XGBoost (Tier 1 → Tier 2) | S6–8 | Gustavo/Dev |

### 6.2 Fontes de Dados e APIs

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Substituição completa do RapidAPI por scraping direto GraphQL do Airbnb — domínio .com.br + fallback intl + decode Base64 Relay + cron mensal (commits 135dc46, 7555609, 130cee0) | S3–4 | Gustavo/Dev |
| ✅ | Pesquisa de fontes realizada: InsideAirbnb não cobre SP diretamente. Fontes mapeadas: AirROI free (28k listings SP), Base dos Dados BigQuery, Airbtics US$29/mês. Documentado em runbooks/dataset-acquisition.md (commit 593d846) | S5 | Gustavo/Dev |
| ⬜ | Reunião estratégica com PriceLabs — parceria ou benchmark | S5 | Gustavo |
| ⬜ | Ampliar cobertura dos spiders para novos bairros/regiões de SP | S6–8 | Gustavo/Dev |

### 6.3 Painel Administrativo Urban AI

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Painel admin completo: /admin/users (gestão de usuários, papéis, RolesGuard) + /admin/overview + 6 endpoints backend com autenticação por role (commits 35ae7c2 + b5e7eb3) | S5 | Gustavo/Dev |
| ✅ | Analytics do motor de eventos em /admin/events: cobertura geo, % Gemini, volume 7/30/90d, mega-eventos, top 10 por relevância (commit b5e7eb3) | S5 | Gustavo/Dev |
| ✅ | /admin/stays + /admin/funnel (funil signup→assinatura) + /admin/quality (MAPE real, gate de qualidade) (commit b5e7eb3) | S5 | Gustavo/Dev |
| ✅ | Módulo financeiro /admin/finance: MRR estimado, custos CRUD, margem por imóvel ativo (verde/amarelo/vermelho). Entity PlatformCost + migration + seed + 11 testes (commits 188a896 + 0df8a85) | S5 | Gustavo/Dev |
| ✅ | /admin/pricing-config: editar preços F6.5 sem tocar código. Endpoints GET/PATCH /admin/plans-config/* (commit 188a896) | S5 | Gustavo/Dev |
| ⬜ | Configurar e-mails de onboarding automático via Mailersend (triggers D+0/D+3/D+7) | S6–8 | Gustavo/Dev |
| ⬜ | Implementar NPS e métricas de ativação/retenção no dashboard (hoje apenas funil admin) | S8–10 | Gustavo/Dev |

### 6.4 Integração Stays — Aplicação Automática de Preços

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Dual-mode integration com API Stays: modo Recomendação (usuário aplica) + modo Automático (cron aplica via Stays Open API com guardrails). Entidades StaysAccount, StaysListing, StaysPushHistory criadas (commit c634805) | S5 | Gustavo/Dev |
| 🔄 | Conectar integração Stays em produção — requer conta Stays ativa e credenciais OAuth (parceria Airbnb Preferred+) | S6–7 | Gustavo |

### 6.5 Modelo de Cobrança por Imóvel

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ✅ | Cobrança por imóvel com 4 ciclos e descontos progressivos: mensal (cheio), trimestral (−15%), semestral (−25%), anual (−40%). PricingCalculatorV2 no frontend (commit 5e60be9) | S5 | Gustavo/Dev |
| ✅ | Bloqueio server-side real: ListingsQuotaGuard retorna ForbiddenException 403 com `LISTINGS_QUOTA_EXCEEDED` — proteção real, não só UX (commit 5e60be9) | S5 | Gustavo/Dev |
| ✅ | Preços exatos no Stripe: R$124/mês e R$99/mês (anual) para Profissional; R$248/mês e R$199/mês (anual) para Escala (commits 022b19c + 041b565) | S5 | Gustavo/Dev |
| ✅ | Refactor dos pricing cards: GlobalPaywallModal, planos e onboarding com layout responsivo consistente nas 3 telas (commit a816a12) | S5 | Gustavo/Dev |

---

## F7 — Beta Fechado e Go-Live Oficial

**Período:** Semanas 8–14 (18/05 → 04/07/2026)  
**Custo estimado:** 💰 Mídia no go-live + ajustes de produto

### 7.1 Beta Fechado

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Selecionar 5–10 anfitriões Airbnb em SP para beta (contato direto) | S7–8 | Gustavo |
| ⬜ | Integrar usuários beta gratuitamente — acompanhar onboarding | S8–9 | Gustavo |
| ⬜ | Coletar feedback estruturado (formulário + entrevistas curtas) | S9–10 | Gustavo |
| ⬜ | Priorizar e implementar correções críticas levantadas no beta | S10–12 | Gustavo/Dev |

### 7.2 Go-Live Oficial

| Status | Tarefa | Semana | Resp. |
|--------|--------|--------|-------|
| ⬜ | Checklist final de segurança e compliance antes do lançamento | S12 | Gustavo |
| ✅ | Press release de lançamento (formato jornalístico) + email HTML para lista de interesse (3 subject lines A/B, CTA direto para /register) | S12–13 | Gustavo |
| ⬜ | Anunciar lançamento oficial — Instagram, LinkedIn, e-mail para lista de interesse | S13–14 | Gustavo |
| ⬜ | Ativar campanhas de tráfego pago no go-live 💰 | S13–14 | Gustavo |
| ⬜ | Monitorar métricas de ativação e retenção nas primeiras 2 semanas | S14+ | Gustavo |

---

## Marcos Críticos — Próximas Semanas

| Quando | Marco | Impacto se atrasar |
|--------|-------|--------------------|
| Semana 1 | Submeter KYC Stripe | Cobranças reais bloqueadas |
| Semana 1 | Aprovar orçamento de marketing | F5 inteira bloqueada |
| S1–2 | Transferências de domínio concluídas | Landing page não publica em urbanai.com.br |
| S2–3 | Onboarding + fluxo de cadastro corrigido (F5A) | Tráfego pago chegando num produto com problemas → churn alto |
| S3–4 | Landing page no ar em urbanai.com.br | Sem landing = sem conversão de tráfego pago |
| S4 | Validação ponta a ponta concluída (F5A) | Não lançar tráfego pago antes de F5A aprovada |
| Semana 8 | Beta fechado iniciado | Atraso no go-live oficial |
| S13–14 | Go-Live Oficial | — |

---

## Resumo de Custos Pós-Sprint

| Fase | Custo estimado | Quando |
|------|----------------|--------|
| F5 — Presença Digital | R$ 2.000–5.000/mês mídia + R$ 3.000–8.000 produção | A partir de S1 |
| F6 — IA e Produto | Horas de dev (a definir) | S3–10 |
| F7 — Beta e Go-Live | R$ 5.000–10.000 mídia no lançamento | S13–14 |
| Infraestrutura Railway | ~R$ 1.000/mês (já ativo) | Recorrente |
| Google Cloud | Grátis até 15/06/2026 (R$ 1.759 crédito) | — |
| AWS S3 | Grátis até esgotar (USD 200 crédito) | — |

---

*Urban AI © 2026 · Uso interno · Relatório Semanas 3–4 · 13/04/2026*
