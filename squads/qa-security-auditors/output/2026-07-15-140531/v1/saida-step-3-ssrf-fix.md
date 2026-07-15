# Evidência de correção — SEC-P1-03 SSRF em `connect/resolve`

**Data:** 2026-07-15  
**Escopo exclusivo:** resolver de links Airbnb em `urban-ai-backend-main/src/connect`; nenhum arquivo de auth, propriedades, CI ou documentação de produto foi alterado.

## Resultado

O `connect/resolve` deixou de executar `fetch` diretamente com `redirect: 'follow'`. A operação agora usa um resolvedor reutilizável e testável, fail-closed, que aplica a política antes da primeira chamada e novamente a cada redirecionamento.

### Controles implementados

| Controle | Implementação/evidência |
|---|---|
| Somente HTTPS | `safe-airbnb-url-resolver.ts:112-126` rejeita qualquer protocolo diferente de `https:`. |
| Allowlist exata | `safe-airbnb-url-resolver.ts:4-9` permite somente `airbnb.com`, `www.airbnb.com`, `airbnb.com.br` e `www.airbnb.com.br`; `:140-148` faz igualdade exata. |
| Sem credenciais/porta alternativa | `safe-airbnb-url-resolver.ts:127-139` rejeita userinfo e porta diferente de 443. |
| IPs não públicos | `safe-airbnb-url-resolver.ts:12-44` bloqueia ranges privados, loopback, link-local, documentação, multicast e reservados IPv4/IPv6; `:92-109` também normaliza IPv4 mapeado em IPv6. |
| DNS público | `safe-airbnb-url-resolver.ts:152-202` resolve todos os endereços e falha se a resposta estiver vazia ou se qualquer endereço não for público. |
| Redirect manual por salto | `safe-airbnb-url-resolver.ts:212-307` usa `redirect: 'manual'`, limita a cinco saltos e reaplica protocolo, host e DNS a cada `Location`. |
| Timeout total | `safe-airbnb-url-resolver.ts:152-190` limita DNS; `:218-258` usa deadline total e `AbortController` no request. Padrão: 5 s. |
| Tamanho/corpo | `safe-airbnb-url-resolver.ts:261-269` rejeita `Content-Length` acima de 1 MB; nenhum corpo é consumido e o stream é cancelado em `:204-210`. |
| Integração Nest | `connect.service.ts:18-20,939-948` delega ao helper e converte violações em `BadRequestException` com mensagem controlada. |

## Testes de ataque e regressão

Arquivo: `urban-ai-backend-main/src/connect/safe-airbnb-url-resolver.spec.ts`.

Cobertura explícita:

- `localhost`;
- RFC1918: `10/8`, `172.16/12` e `192.168/16`;
- metadata/link-local `169.254.169.254`;
- IPv6 loopback `::1`, ULA `fc00::/7`, link-local `fe80::/10` e IPv4 mapeado;
- host com sufixo enganoso `www.airbnb.com.evil.test`;
- protocolo HTTP;
- hostname permitido resolvendo via DNS para loopback;
- redirect Airbnb público → `169.254.169.254`, bloqueado antes do segundo fetch;
- redirect válido `www.airbnb.com` → `www.airbnb.com.br`;
- limite declarado de tamanho;
- abort por timeout;
- IPs publicamente roteáveis positivos.

### Comandos executados

```text
npm test -- --runInBand src/connect/safe-airbnb-url-resolver.spec.ts src/connect/connect.controller.spec.ts

PASS
Test Suites: 2 passed, 2 total
Tests:       25 passed, 25 total
```

```text
npm run build

> nest build
Exit code: 0
```

Uma tentativa adicional de lint focado com ESLint não pôde ser usada como gate porque o workspace está em ESLint 10.7.0 e não contém `eslint.config.js|mjs|cjs`; o comando encerrou antes de analisar os arquivos. O TypeScript foi validado pelo build e pelo `ts-jest`.

## Decisão sobre Push

Os endpoints Web Push **não foram alterados nesta correção**. Eles aceitam endpoints dinâmicos de provedores diferentes, enquanto este helper possui allowlist deliberadamente fixa e exata do Airbnb. Reutilizá-lo diretamente quebraria assinaturas legítimas ou exigiria enfraquecer a política do resolver Airbnb.

Pendência preservada: criar política separada para Web Push com validação de IP público, re-resolução, redirects desabilitados, timeout/tamanho e, quando viável, allowlist dos provedores efetivamente suportados. Essa pendência não reabre o SSRF específico de `connect/resolve` corrigido aqui.

## Arquivos alterados

- `urban-ai-backend-main/src/connect/safe-airbnb-url-resolver.ts` — novo helper de política e resolução segura.
- `urban-ai-backend-main/src/connect/safe-airbnb-url-resolver.spec.ts` — testes unitários determinísticos com DNS/fetch injetáveis.
- `urban-ai-backend-main/src/connect/connect.service.ts` — integração do helper no fluxo existente.

```yaml
finding: SEC-P1-03
status: fixed_locally
focused_tests: 25_passed
build: passed
push_ssrf: pending_separate_policy
release_evidence: squads/qa-security-auditors/output/2026-07-15-140531/v1/saida-step-3-ssrf-fix.md
```
