# Ações do owner para certificar o scorecard 10/10

**Data:** 2026-07-15  
**Última atualização:** 2026-07-20
**Status:** handoff das dependências externas; executar depois de revisar as entregas autônomas  
**Owner primário:** Gustavo  
**Fonte de escopo:** [`../plano-mestre-scorecard-10-10-2026-07-15.md`](../plano-mestre-scorecard-10-10-2026-07-15.md)

## Regra de segurança

Não colar tokens, senhas, dumps, dados pessoais ou chaves em chat, issue, commit ou documentação. Configurar secrets diretamente no provedor e registrar apenas nome, owner, ambiente, data de rotação e resultado do gate.

## 1. Incidente Git, privacidade e jurídico — prioridade P0

- [ ] Nomear responsável técnico e jurídico para o incidente histórico.
- [ ] Revisar as 11 referências históricas detectadas pelo auditor, em ambiente restrito, sem publicar conteúdo.
- [ ] Rotacionar credenciais potencialmente expostas em Railway/MySQL, AWS, Stripe, Brevo, Google, Sentry, Prefect, Scrapyd e integrações.
- [ ] Decidir com jurídico se há obrigação de comunicação a titulares/ANPD e registrar a decisão no postmortem.
- [ ] Autorizar e agendar uma única reescrita coordenada do histórico Git, incluindo comunicação aos colaboradores, invalidação de clones/caches e sincronização dos forks.
- [ ] Decidir retenção, base legal e acesso do DOCX de perfil pessoal em `docs/archive/docx/restricted-review/`.
- [ ] Revisar/aceitar DPAs e os textos de privacidade, termos e SLA. O SLA continua rascunho até aceite jurídico formal.

**Aceite:** auditor histórico deixa de encontrar os objetos após a reescrita coordenada; todas as credenciais têm evidência de rotação posterior; decisão jurídica e de retenção está registrada sem dados pessoais.

## 2. Acessos e infraestrutura — prioridade P1

- [x] Autenticar a Railway CLI no workspace/conta corretos e confirmar projeto, ambiente e serviços antes de qualquer alteração. Validado em 2026-07-20.
- [ ] Liberar acesso Cloudflare/DNS para os domínios Urban AI. Credenciais obtidas pelo owner; configuração e validação segura ainda pendentes.
- [ ] Definir um hostname canônico para a API e alinhar Railway, frontend, CORS, documentação e monitores.
- [ ] Criar/corrigir DNS de `status`, `staging` e `staging-api`; validar resolução pública e TLS.
- [x] Configurar `HEALTH_READINESS_TOKEN` no backend e o mesmo valor apenas no secret store do monitor/gate. Produção validada com 401 anônimo e 200 autorizado em 2026-07-20.
- [x] Provisionar Redis de produção persistente, rotacionar a credencial e validar DB/Redis no readiness. Evidência em [`../evidence/production-redis-readiness-2026-07-20.md`](../evidence/production-redis-readiness-2026-07-20.md).
- [ ] Configurar status page e monitorar home, `/health/live` e `/health` autenticado como sinais distintos.

**Aceite:** DNS resolve; TLS é válido; liveness e readiness retornam 200 nos contextos corretos; o gate enterprise passa 6/6; nenhum valor de secret aparece em log ou evidência.

## 3. Provedores e fluxos financeiros

- [ ] Concluir KYC/ativação live do Stripe, cadastrar Price IDs por plano/ciclo e webhook assinado.
- [ ] Rodar checkout, renovação, falha, recuperação, cancelamento, quota e reconciliação em modo test antes do live.
- [ ] Validar domínio/remetente Brevo, DKIM/SPF, reset de senha e confirmação em caixa de teste.
- [ ] Obter credenciais/aceite da parceria Stays e executar `connect → preview → push → rollback` com imóvel de teste.
- [ ] Aprovar budgets/quotas de Google Maps, Gemini e demais coletores pagos; definir alertas de custo e kill switch.
- [ ] Confirmar DSN/alertas Sentry e responsáveis por severidade.

**Aceite:** cada fluxo possui ID de execução, timestamp, ambiente, resultado esperado/observado e rollback comprovado; nenhuma captura contém segredo ou dado pessoal desnecessário.

## 4. Staging, DR e testes reais

- [ ] Criar usuários de teste host/admin e armazenar credenciais somente no secret store do CI/staging.
- [ ] Executar os E2E credencial-gated no hostname de staging final.
- [ ] Rodar smoke responsivo em dispositivos reais ou device farm para Android/iOS, PWA, push, zoom e leitor de tela.
- [ ] Executar restore de um backup real em banco temporário isolado; nunca sobre produção.
- [ ] Medir e registrar RPO, RTO, integridade pós-restore, rollback de deploy/migration e descarte seguro do banco temporário.
- [ ] Confirmar existência, criptografia, retenção e restauração do objeto off-site.

Antes do drill, os gates locais devem continuar verdes:

```powershell
npm run gate:repository
npm run slo:probe:self-test
cd urban-ai-backend-main
npm run audit:migrations:strict
```

**Aceite:** restore e rollback reais são repetíveis por outra pessoa seguindo o runbook; RPO/RTO medidos atendem à política aprovada.

## 5. Beta, dados e prova de produto

- [ ] Selecionar 5–10 anfitriões beta com consentimento e critérios de sucesso definidos.
- [ ] Garantir captura de outcome em pelo menos 80% das recomendações elegíveis.
- [ ] Aprovar coortes, baseline e janela para backtest; registrar MAPE, drift, cobertura e leakage.
- [ ] Revisar manualmente recomendações extremas, falsos positivos de eventos e explicações antes de liberar automação.
- [ ] Produzir cases auditáveis de valor/ROI sem expor dados pessoais ou comerciais de clientes.

**Aceite:** dataset e modelo são versionados; backtest por coorte passa o gate acordado; promoção é reversível; os resultados podem ser reproduzidos a partir das evidências autorizadas.

## 6. Certificação final

- [x] Publicar a branch e observar CodeQL/CI/release gate completos; checks canônicos verdes no SHA `ca999392` em 2026-07-20.
- [ ] Tornar checks críticos obrigatórios e exigir revisão para mudanças de produção.
- [ ] Acumular pelo menos 14 dias de observação com SLO aprovado, sem P0/P1 aberto.
- [ ] Revisar o scorecard com Produto, Engenharia, Operação, Segurança e Jurídico usando apenas evidência datada.
- [ ] Aprovar go-live, SLA e comunicação aos clientes em reunião registrada.

**10/10 só é certificado quando:** zero P0/P1; readiness/status/DNS operacionais; DR real exercitado; billing e Stays reais validados; outcome ≥80%; SLO ≥99,9% na janela aprovada; jurídico e segurança formalmente aceitos.
