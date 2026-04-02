# Prompt — Agente Checklist Final de Segurança Urban AI
> Cole este prompt numa nova sessão de agente. Preencha as variáveis entre [ ] antes de rodar.

---

## CONTEXTO

Você é um agente de segurança responsável por executar e verificar o checklist final do sprint de migração do sistema Urban AI. O sprint está em D13/14 — quase tudo foi concluído. Sua missão é verificar cada item, corrigir o que for possível automaticamente e reportar o que precisa de ação manual.

**Credenciais e dados necessários:**
- URL do backend Railway: `[URL_BACKEND]`
- URL do frontend: `https://app.myurbanai.com`
- Acesso Railway CLI (MCP já configurado) ou variáveis via painel
- AWS Access Key: `[AWS_ACCESS_KEY_ID]`
- AWS Secret Key: `[AWS_SECRET_ACCESS_KEY]`
- JWT atual no Railway: `[JWT_SECRET_ATUAL]` (confirmar se ainda é "mysecretkey")
- ID do template de confirmação no Mailersend: `[MAILERSEND_TEMPLATE_ID]` (formato: ex. `pxkjn41...`, NÃO começa com `d-`)

---

## INSTRUÇÕES GERAIS

Execute os itens **na ordem abaixo**. Para cada um:
1. Verifique o estado atual
2. Corrija automaticamente se possível via bash/curl/CLI
3. Se depender de painel externo (Railway, AWS console), forneça as instruções exatas para o usuário executar
4. Registre: ✅ RESOLVIDO, ❌ FALHOU, ⚠️ AÇÃO MANUAL NECESSÁRIA, ou ⏭️ JÁ ESTAVA OK

Ao final, gere um relatório consolidado em Markdown.

---

## ITEM 1 — JWT_SECRET (CRÍTICO 🔴)

**Problema:** O JWT_SECRET provavelmente ainda é `mysecretkey` — valor padrão inseguro que expõe toda a autenticação do sistema.

**Verificar:**
```bash
# Tenta detectar se o JWT atual é fraco (sem revelar o valor)
curl -s -X POST [URL_BACKEND]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@urbanai.com", "password": "qualquercoisa"}' | head -c 200
```

**Ação — Gerar novo JWT_SECRET seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Instrução para o usuário:**
1. Copie o valor gerado acima
2. Acesse Railway → seu projeto → serviço backend → Variables
3. Atualize `JWT_SECRET` com o novo valor
4. Railway fará redeploy automático
5. Todos os usuários logados precisarão fazer login novamente (comportamento esperado e correto)

**Resultado esperado:** JWT_SECRET com 128 caracteres hexadecimais aleatórios.

---

## ITEM 2 — MAILERSEND_CONFIRM_EMAIL_TEMPLATE (BUG 🔴)

**Problema:** A variável `MAILERSEND_CONFIRM_EMAIL_TEMPLATE` tem um ID no formato SendGrid (`d-xxxxxxxx`) em vez do formato Mailersend. Isso faz o email de confirmação de cadastro falhar silenciosamente.

**Verificar formato atual:**
```bash
curl -s -X POST [URL_BACKEND]/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste Bug", "email": "bugtest-[TIMESTAMP]@urbanai.com", "password": "Teste@123"}'
```

**Ação:**
1. Acesse [app.mailersend.com](https://app.mailersend.com) → **Email** → **Templates**
2. Abra o template de confirmação de e-mail
3. Copie o ID que aparece na URL ou nos detalhes do template (formato: string alfanumérica, ex: `pxkjn41zz8v42yo6`)
4. No Railway → backend → Variables → atualize `MAILERSEND_CONFIRM_EMAIL_TEMPLATE` com esse ID correto

**Verificar após correção:**
```bash
# Registrar usuário novo e verificar se email de confirmação é disparado sem erro
curl -s -X POST [URL_BACKEND]/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste Mailersend", "email": "[SEU_EMAIL_REAL]", "password": "Teste@123"}'
```
**Esperado:** status 201 e email chegando na caixa de entrada com template correto.

---

## ITEM 3 — VARIÁVEIS DE AMBIENTE (LIMPEZA 🟡)

**Verificar se ainda existem variáveis com referências à Lumina Lab:**
```bash
# Testar se EMAIL_SENDER ainda aponta para Lumina
curl -s [URL_BACKEND]/health | grep -i "lumina\|fabricio\|here_api"
```

**Checklist de variáveis — verificar no painel Railway:**

| Variável | Valor esperado | Sinalizar se encontrar |
|----------|---------------|----------------------|
| `EMAIL_SENDER` | `noreply@myurbanai.com` | qualquer @luminalab.ai |
| `DB_USER` | `urbanai_app` | `root` |
| `JWT_SECRET` | string longa aleatória | `mysecretkey` ou similar |
| `HERE_API_KEY` | não deve existir | qualquer valor |
| `RAPIDAPI_KEY` | chave conta Urban AI | chave Fabrício antiga |
| `API_URL` | URL Railway atual | URL antiga ou localhost |

**Para cada variável com valor incorreto:** instruir o usuário a corrigir no painel Railway.

---

## ITEM 4 — AWS S3 BUCKET (SEGURANÇA 🟡)

**Verificar Block Public Access:**
```bash
AWS_ACCESS_KEY_ID=[AWS_ACCESS_KEY_ID] \
AWS_SECRET_ACCESS_KEY=[AWS_SECRET_ACCESS_KEY] \
AWS_DEFAULT_REGION=sa-east-1 \
aws s3api get-bucket-public-access-block --bucket urbanai-data-lake 2>&1
```
**Esperado:** todos os 4 campos como `true` (BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy, RestrictPublicBuckets).

**Verificar permissões do IAM user:**
```bash
AWS_ACCESS_KEY_ID=[AWS_ACCESS_KEY_ID] \
AWS_SECRET_ACCESS_KEY=[AWS_SECRET_ACCESS_KEY] \
AWS_DEFAULT_REGION=sa-east-1 \
aws iam list-attached-user-policies --user-name urban-ai-scrapy 2>&1
```
**Esperado:** apenas `AmazonS3FullAccess` — sem `AdministratorAccess` ou `IAMFullAccess`.

**Verificar que o bucket está acessível:**
```bash
AWS_ACCESS_KEY_ID=[AWS_ACCESS_KEY_ID] \
AWS_SECRET_ACCESS_KEY=[AWS_SECRET_ACCESS_KEY] \
AWS_DEFAULT_REGION=sa-east-1 \
aws s3 ls s3://urbanai-data-lake/ 2>&1 | head -5
```

---

## ITEM 5 — DNS E SSL (VERIFICAÇÃO PÓS-CONFIGURAÇÃO 🟡)

**Verificar propagação DNS — myurbanai.com raiz:**
```bash
dig myurbanai.com A +short
dig myurbanai.com CNAME +short
curl -s -o /dev/null -w "Status: %{http_code} | SSL: %{ssl_verify_result}\n" https://myurbanai.com
```
**Esperado:** IP ou CNAME resolvendo, status 200 ou 301, SSL=0.

**Verificar registros Mailersend (SPF/DKIM):**
```bash
dig TXT myurbanai.com +short | grep -i "spf\|mailersend\|v=spf"
dig TXT mailersend._domainkey.myurbanai.com +short | grep -i "DKIM\|v=DKIM"
```
**Esperado:** registros SPF com `include:spf.mailersend.net` e DKIM com chave pública válida.

**Verificar SSL em todos os domínios:**
```bash
for domain in app.myurbanai.com myurbanai.com urbanai.com.br; do
  echo "=== $domain ==="
  echo | openssl s_client -connect $domain:443 -servername $domain 2>/dev/null \
    | openssl x509 -noout -dates 2>/dev/null || echo "SSL não disponível ainda"
done
```
**Esperado:** datas `notAfter` futuras em todos os domínios.

---

## ITEM 6 — VERIFICAR ACESSOS LUMINA REVOGADOS 🟡

**Testar se credenciais antigas do banco ainda funcionam (root):**
```bash
# Tentar acessar rota que exige DB com user root antigo — deve falhar se foi revogado
curl -s -X GET [URL_BACKEND]/health/db \
  -H "Authorization: Bearer [TOKEN_ADMIN_SE_TIVER]"
```

**Verificar endpoint de health geral:**
```bash
curl -s [URL_BACKEND]/health
```
**Esperado:** status 200, conexão DB usando `urbanai_app` (não root).

**Checklist manual — confirmar com o usuário:**
- [ ] Fabrício removido do Railway
- [ ] Felipe removido do Railway
- [ ] Lumina removida do Google Cloud (projeto Urban AI)
- [ ] Lumina removida do AWS (IAM users da Lumina deletados)
- [ ] Lumina removida do Sentry
- [ ] Lumina removida do RapidAPI
- [ ] Lumina removida do Stripe

---

## ITEM 7 — TESTE FINAL DE SAÚDE DO SISTEMA 🟢

**Health check completo:**
```bash
echo "=== BACKEND ===" && \
curl -s -w "\nHTTP:%{http_code}" [URL_BACKEND]/health && \
echo "\n=== FRONTEND ===" && \
curl -s -o /dev/null -w "HTTP:%{http_code}" https://app.myurbanai.com && \
echo "\n=== DNS myurbanai.com ===" && \
curl -s -o /dev/null -w "HTTP:%{http_code}" https://myurbanai.com
```

**Teste de autenticação com novo JWT_SECRET:**
```bash
# Após rotacionar o JWT, confirmar que login ainda funciona
curl -s -X POST [URL_BACKEND]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "[EMAIL_TESTE]", "password": "[SENHA_TESTE]"}' | python3 -m json.tool
```
**Esperado:** novo `access_token` gerado com sucesso.

---

## RELATÓRIO FINAL

Ao concluir todos os itens, gere um relatório em Markdown com esta estrutura:

```markdown
# Checklist Final de Segurança — Urban AI
**Data:** [DATA]
**Sprint:** D13/14 — Encerramento

## Resultado por Item

| # | Item | Status | Ação Realizada |
|---|------|--------|----------------|
| 1 | JWT_SECRET | ✅/❌/⚠️ | ... |
| 2 | Mailersend Template | ✅/❌/⚠️ | ... |
| 3 | Variáveis de Ambiente | ✅/❌/⚠️ | ... |
| 4 | AWS S3 Segurança | ✅/❌/⚠️ | ... |
| 5 | DNS e SSL | ✅/❌/⚠️ | ... |
| 6 | Acessos Lumina Revogados | ✅/❌/⚠️ | ... |
| 7 | Health Check Final | ✅/❌/⚠️ | ... |

## Sistema em D13 — Status Final
[Resumo do estado geral do sistema]

## Ações Manuais Pendentes
[Lista do que o usuário ainda precisa fazer manualmente]

## Pronto para Go-Live?
[Sim/Não + justificativa]
```

Salve como `checklist-seguranca-d13.md` na pasta de outputs.
