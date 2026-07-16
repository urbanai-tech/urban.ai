# Observabilidade segura: Sentry, correlationId e logs

**Owner:** Engenharia + Operações  
**Status:** controles locais implementados; ingestão externa pendente de verificação  
**Última validação sem credenciais:** 2026-07-15

## Contrato runtime

| Campo | Origem | Regra |
|---|---|---|
| `environment` | `APP_ENV`, depois `NODE_ENV` | Diferenciar produção, staging e desenvolvimento |
| `release` | `SENTRY_RELEASE`, `RAILWAY_GIT_COMMIT_SHA`, `GITHUB_SHA` ou versão do pacote | Deploy deve preferir SHA imutável |
| `requestId` | `x-request-id` válido ou UUID gerado | 1–120 caracteres, somente letras, números, `.`, `_`, `:` e `-` |

`sendDefaultPii` permanece `false`. O `beforeSend` remove chaves de segredo/PII e padrões de e-mail, bearer/basic auth, JWT, credenciais de URL de banco, chaves Stripe e query params sensíveis.

## Log HTTP estruturado

Ao terminar a resposta, o middleware registra um JSON com:

```json
{
  "event": "http_request",
  "requestId": "edge-req-123",
  "method": "POST",
  "route": "/payments/create-checkout-session",
  "statusCode": 201,
  "durationMs": 42.3,
  "environment": "staging",
  "release": "commit-sha"
}
```

Logs HTTP nunca devem incluir body, query string, cookies ou headers de autorização. A rota usa template quando disponível, evitando IDs reais. Objetos completos de usuário, imóvel, pagamento ou request são proibidos.

## Gate sem credenciais

```bash
cd urban-ai-backend-main
npm run audit:observability:self-test
npm run audit:observability
npx jest --runInBand src/common/observability.spec.ts src/common/request-id.middleware.spec.ts
```

O gate comprova configuração local, redaction, validação do request-id, metadata e formato do log. Ele não inicializa transporte externo e não envia eventos.

## Validação em staging

1. Configurar `APP_ENV=staging` e `SENTRY_RELEASE=<commit-sha>`; Railway pode fornecer `RAILWAY_GIT_COMMIT_SHA` como fallback.
2. Fazer request com `x-request-id` opaco conhecido.
3. Confirmar o mesmo ID no header de resposta, log Railway e tag/contexto do evento Sentry.
4. Confirmar `environment` e `release` corretos.
5. Usar somente o endpoint de teste protegido por admin; nunca inserir PII ou segredo no erro.
6. Verificar que e-mail, authorization, cookies, tokens e credenciais não aparecem no evento/breadcrumbs.

## Limites honestos

O gate local não prova ingestão, alertas ou release no projeto Sentry real. Também não garante que SDKs futuros respeitem a política; todo novo transporte precisa passar pelo sanitizador e por revisão. A certificação depende de smoke em staging, inspeção do evento recebido e alerta testado sem dados pessoais.
