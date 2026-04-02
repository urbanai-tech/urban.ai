# Prompt — Agente de Testes Urban AI
> Cole este prompt numa nova sessão de agente. Preencha todas as variáveis entre [ ] antes de rodar.

---

## CONTEXTO

Você é um agente de QA responsável por executar os testes de validação do sistema Urban AI antes do go-live. O sistema é composto por:

- **Backend**: NestJS rodando no Railway → `[URL_BACKEND]` (ex: https://urban-ai-backend-production.up.railway.app)
- **Frontend**: Next.js rodando em → `https://app.myurbanai.com` (ou `[URL_FRONTEND_RAILWAY]` caso o DNS ainda não esteja resolvendo)
- **Banco de dados**: MySQL no Railway (acesso indireto via API)
- **Spiders**: Scrapyd rodando em → `[URL_SCRAPYD]` (ex: https://urban-ai-scrapy.up.railway.app)
- **Storage**: AWS S3, bucket `urbanai-data-lake`, região `sa-east-1`
- **Monitoramento**: Sentry (projeto `urban-ai-backend` e `urban-ai-frontend`)

**Credenciais de teste disponíveis:**
- Email de teste: `[EMAIL_TESTE]` (ex: teste-qa@urbanai.com)
- Senha de teste: `[SENHA_TESTE]`
- AWS Access Key: `[AWS_ACCESS_KEY_ID]`
- AWS Secret Key: `[AWS_SECRET_ACCESS_KEY]`
- Stripe Test Key (pk): `[STRIPE_PUBLISHABLE_KEY_TEST]`
- Stripe Test Card: `4242 4242 4242 4242`, validade `12/30`, CVV `123`

---

## INSTRUÇÕES GERAIS

Execute os testes **na ordem T1 → T7**. Para cada teste:
1. Execute todos os passos via `curl`, `bash`, ou browser (Claude in Chrome se necessário)
2. Registre o resultado: ✅ PASSOU, ❌ FALHOU, ou ⚠️ PARCIAL
3. Se um passo falhar, registre o erro exato e continue para o próximo passo (não interrompa o teste inteiro)
4. Ao final de cada teste, imprima um resumo dos resultados
5. Ao final de **todos os testes**, gere um relatório consolidado em formato Markdown

---

## T1 — CADASTRO E AUTENTICAÇÃO

**Objetivo:** Validar fluxo completo de registro, login, JWT e proteção de rotas.

### Passo 1 — Cadastrar novo usuário
```bash
curl -s -X POST [URL_BACKEND]/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA Tester",
    "email": "[EMAIL_TESTE]",
    "password": "[SENHA_TESTE]"
  }'
```
**Esperado:** status 201 ou 200, body com `id` ou `message` de sucesso.

### Passo 2 — Login e obter JWT
```bash
curl -s -X POST [URL_BACKEND]/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "[EMAIL_TESTE]",
    "password": "[SENHA_TESTE]"
  }'
```
**Esperado:** status 200, body com campo `access_token` (JWT). Salve o token como `$TOKEN`.

### Passo 3 — Acessar rota protegida
```bash
curl -s -X GET [URL_BACKEND]/users/me \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200, dados do usuário logado.

### Passo 4 — Tentar acessar rota protegida sem token
```bash
curl -s -X GET [URL_BACKEND]/users/me
```
**Esperado:** status 401 Unauthorized.

### Passo 5 — Solicitar recuperação de senha
```bash
curl -s -X POST [URL_BACKEND]/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "[EMAIL_TESTE]"}'
```
**Esperado:** status 200 ou 201, mensagem de confirmação. (O email não precisa chegar para o teste passar — apenas a API deve responder corretamente.)

---

## T2 — ASSINATURA STRIPE (modo teste)

**Objetivo:** Validar fluxo de assinatura com cartão de teste Stripe.

> ⚠️ Este teste usa o modo sandbox do Stripe. Nenhum valor real é cobrado.
> Use apenas se `[STRIPE_PUBLISHABLE_KEY_TEST]` estiver disponível e começar com `pk_test_`.

### Passo 1 — Verificar se endpoint de checkout existe
```bash
curl -s -X POST [URL_BACKEND]/subscriptions/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}'
```
**Esperado:** status 200 com `url` de checkout Stripe, OU status 400/422 com mensagem de erro clara (não 500).

### Passo 2 — Verificar endpoint de webhook (health check)
```bash
curl -s -X POST [URL_BACKEND]/subscriptions/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Esperado:** qualquer resposta que não seja timeout ou 500 genérico. Um 400 "invalid signature" é resultado correto — significa que o endpoint existe e está validando.

### Passo 3 — Verificar status de assinatura do usuário
```bash
curl -s -X GET [URL_BACKEND]/subscriptions/status \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200 com campo `status` (ex: `active`, `inactive`, `trialing`).

---

## T3 — DASHBOARD E RECOMENDAÇÃO KNN

**Objetivo:** Validar endpoints de dados do dashboard e motor de recomendação de preço.

### Passo 1 — Listar propriedades do usuário
```bash
curl -s -X GET [URL_BACKEND]/propriedades \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200, array (pode ser vazio `[]`).

### Passo 2 — Criar uma propriedade de teste
```bash
curl -s -X POST [URL_BACKEND]/propriedades \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Apto Teste QA",
    "endereco": "Rua das Flores, 100, São Paulo, SP",
    "quartos": 2,
    "banheiros": 1,
    "capacidade": 4,
    "tipo": "apartamento"
  }'
```
**Esperado:** status 201, objeto com `id` da propriedade. Salve como `$PROP_ID`.

### Passo 3 — Buscar recomendação de preço (KNN)
```bash
curl -s -X GET "[URL_BACKEND]/propriedades/$PROP_ID/recomendacao" \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200, objeto com campo `preco_recomendado` ou similar. Se 404, teste o endpoint `/recommendations` ou `/knn`.

### Passo 4 — Buscar dados do dashboard
```bash
curl -s -X GET [URL_BACKEND]/dashboard \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200, objeto com métricas (pode incluir `ocupacao`, `receita`, `propriedades`).

---

## T4 — SPIDERS E ARMAZENAMENTO S3

**Objetivo:** Validar que os spiders Scrapyd estão ativos e que o S3 está acessível.

### Passo 1 — Listar spiders disponíveis
```bash
curl -s "[URL_SCRAPYD]/listspiders.json?project=default"
```
**Esperado:** status 200, campo `spiders` com array de nomes (ex: `["airbnb_spider", "booking_spider", ...]`).

### Passo 2 — Verificar jobs em execução
```bash
curl -s "[URL_SCRAPYD]/listjobs.json?project=default"
```
**Esperado:** status 200, campos `pending`, `running`, `finished`.

### Passo 3 — Disparar um spider (spider mais leve disponível)
```bash
# Substitua NOME_SPIDER pelo primeiro spider da lista do Passo 1
curl -s -X POST [URL_SCRAPYD]/schedule.json \
  -d "project=default&spider=[NOME_SPIDER]"
```
**Esperado:** status 200, campo `jobid` com ID único.

### Passo 4 — Verificar acesso ao S3
```bash
AWS_ACCESS_KEY_ID=[AWS_ACCESS_KEY_ID] \
AWS_SECRET_ACCESS_KEY=[AWS_SECRET_ACCESS_KEY] \
AWS_DEFAULT_REGION=sa-east-1 \
aws s3 ls s3://urbanai-data-lake/ 2>&1 | head -20
```
**Esperado:** listagem de arquivos (pode estar vazio). Qualquer resposta que não seja "AccessDenied" é sucesso.

### Passo 5 — Aguardar e verificar resultado do spider (2 min)
Após 2 minutos do Passo 3, cheque se o job finalizou:
```bash
curl -s "[URL_SCRAPYD]/listjobs.json?project=default"
```
**Esperado:** jobid do Passo 3 aparece em `finished`.

---

## T5 — NOTIFICAÇÕES

**Objetivo:** Validar que o sistema de emails/notificações está respondendo.

### Passo 1 — Trigger de email de boas-vindas (re-envio)
```bash
curl -s -X POST [URL_BACKEND]/notifications/resend-welcome \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "[EMAIL_TESTE]"}'
```
**Esperado:** status 200/201 com confirmação. Se endpoint não existir (404), tente `/auth/resend-confirmation`.

### Passo 2 — Verificar configuração de email via health
```bash
curl -s [URL_BACKEND]/health
```
**Esperado:** status 200, JSON com status dos serviços. Verifique se há campo `email` ou `mailersend`.

### Passo 3 — Teste de notificação in-app (se existir)
```bash
curl -s -X GET [URL_BACKEND]/notifications \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** status 200, array de notificações (pode ser vazio).

> 📧 **Verificação manual:** Acesse [EMAIL_TESTE] e confirme se algum email chegou nos Passos 1 ou 2.

---

## T6 — SENTRY (MONITORAMENTO DE ERROS)

**Objetivo:** Confirmar que erros do backend chegam ao Sentry.

### Passo 1 — Provocar erro 500 intencional
```bash
curl -s -X GET [URL_BACKEND]/debug/sentry-test \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** qualquer resposta — mesmo 404 significa que o endpoint não existe (use o Passo 2).

### Passo 2 — Alternativa: provocar erro com rota inválida
```bash
curl -s -X POST [URL_BACKEND]/rota-que-nao-existe-qa-test-12345 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "sentry_test"}'
```
**Esperado:** status 404. O Sentry deve capturar a tentativa dependendo da configuração.

### Passo 3 — Verificar saúde geral do backend
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" [URL_BACKEND]/health
```
**Esperado:** status 200, resposta com uptime ou status OK.

> 🔍 **Verificação manual obrigatória:** Acesse app.sentry.io → projeto `urban-ai-backend` → Issues → verifique se novos eventos aparecerem nos últimos 5 minutos.

---

## T7 — DNS E SSL

**Objetivo:** Validar resolução de DNS e certificados SSL dos domínios.

### Passo 1 — Verificar DNS do subdomínio do sistema
```bash
dig app.myurbanai.com CNAME +short
nslookup app.myurbanai.com
```
**Esperado:** resposta apontando para Railway (ex: `*.railway.app` ou similar).

### Passo 2 — Verificar SSL do sistema
```bash
echo | openssl s_client -connect app.myurbanai.com:443 -servername app.myurbanai.com 2>/dev/null | openssl x509 -noout -dates -subject
```
**Esperado:** datas `notBefore` e `notAfter` válidas, `subject` com `CN=app.myurbanai.com` ou wildcard.

### Passo 3 — Verificar resposta HTTPS do sistema
```bash
curl -s -o /dev/null -w "Status: %{http_code} | SSL: %{ssl_verify_result} | Redirect: %{redirect_url}\n" \
  https://app.myurbanai.com
```
**Esperado:** Status 200 ou 301/302 (redirect para login), `ssl_verify_result: 0` (certificado válido).

### Passo 4 — Verificar DNS da landing page
```bash
dig myurbanai.com A +short
curl -s -o /dev/null -w "Status: %{http_code}\n" https://myurbanai.com
```
**Esperado:** IP resolvido, status 200 ou redirect.

### Passo 5 — Verificar apontamento temporário Lumina
```bash
dig urbanai.com.br A +short
curl -s -o /dev/null -w "Status: %{http_code}\n" https://urbanai.com.br
```
**Esperado:** IP resolvido (qualquer). Transferência de domínio ainda em andamento — registrar status atual.

---

## RELATÓRIO FINAL

Ao concluir todos os testes, gere um relatório em Markdown com esta estrutura:

```markdown
# Relatório de Testes — Urban AI
**Data:** [DATA]
**Agente:** Claude QA
**Sprint:** D12/14

## Resumo Executivo
| Teste | Nome | Status | Observações |
|-------|------|--------|-------------|
| T1 | Cadastro/Auth | ✅/❌/⚠️ | ... |
| T2 | Stripe | ✅/❌/⚠️ | ... |
| T3 | Dashboard/KNN | ✅/❌/⚠️ | ... |
| T4 | Spiders/S3 | ✅/❌/⚠️ | ... |
| T5 | Notificações | ✅/❌/⚠️ | ... |
| T6 | Sentry | ✅/❌/⚠️ | ... |
| T7 | DNS/SSL | ✅/❌/⚠️ | ... |

**Total: X/7 testes passaram**

## Detalhes por Teste
[Para cada teste: passos executados, respostas recebidas, erros encontrados]

## Ações Corretivas Recomendadas
[Lista de issues encontrados com sugestão de correção]
```

Salve o relatório como `relatorio-testes-[DATA].md` na pasta de outputs.
