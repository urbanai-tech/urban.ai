# Auditoria independente de Segurança, LGPD e SecOps — Urban AI

**Auditora:** Sofia Segurança  
**Data-base:** 2026-07-15  
**Escopo:** implementação atual do repositório, gates de segurança, autenticação/autorização, segregação entre tenants, inputs, CORS/headers, erros, segredos, dependências, CI, LGPD, backups/DR e integrações críticas.  
**Documento confrontado:** `docs/plano-mestre-scorecard-10-10-2026-07-15.md`.

## 1. Parecer executivo

O sistema **não pode ser certificado como 10/10 nem como “zero P0/P1” no estado auditado**. Há uma vulnerabilidade crítica de mass assignment no cadastro público e três falhas de alta severidade: alteração cross-tenant por identificador público, SSRF autenticado e corrida na rotação de refresh tokens. Também há lacunas materiais em LGPD, headers do frontend, gestão de histórico sensível, validação de inputs, CI de segurança, dependências Python e prova operacional de backup/DR.

Os gates existentes são úteis e vários passaram, mas parte deles prova apenas contratos estáticos. Dois gates produzem falsa sensação de cobertura:

- o gate de autorização ignora rotas `GET`, embora duas delas persistam dados;
- o gate LGPD considera declarações de “não implementado” como contratos aprovados.

### Classificação usada

- **Comprovado:** há evidência local ou runtime direta suficiente para o controle descrito.
- **Contradito:** a implementação ou evidência observada conflita com o requisito/claim.
- **Incompleto:** existe implementação parcial, mas falta controle material ou prova de aceite.
- **Externo:** depende de ambiente, fornecedor, owner, credencial, sandbox ou aprovação não verificável apenas pelo checkout.

## 2. Achados prioritários

### SEC-P0-01 — Mass assignment permite cadastro público com `role=admin`

**Severidade:** Crítica  
**Classificação:** Contradito  
**Área:** Autenticação, autorização, validação de entrada

**Evidência:**

- `urban-ai-backend-main/src/main.ts:18-23` configura `ValidationPipe` com `whitelist: true`, porém `forbidNonWhitelisted: false`.
- `urban-ai-backend-main/src/auth/auth.controller.ts:157-168` usa um tipo inline no body de `/auth/register`, que não existe em runtime como DTO validável.
- `urban-ai-backend-main/src/auth/auth.controller.ts:195-197` envia o objeto recebido diretamente ao serviço.
- `urban-ai-backend-main/src/auth/auth.service.ts:226-242` cria o usuário com `{ ...data, password: pwdHash }`.
- `urban-ai-backend-main/src/entities/user.entity.ts:46-47` e `:71-81` expõem `ativo` e `role` como propriedades persistíveis da entidade.

**Prova executada:** uma chamada isolada ao mesmo `ValidationPipe`, com `metatype: Object` e payload contendo `role: 'admin'` e `ativo: true`, retornou:

```json
{"sameObject":true,"keys":["ativo","email","password","role","username"]}
```

Assim, no modo normal de cadastro público, o atacante consegue enviar propriedades administrativas que sobrevivem ao pipe e são espalhadas na entidade. O branch de pré-lançamento faz mapeamento explícito, mas não elimina a vulnerabilidade do fluxo público normal.

**Impacto:** criação de conta privilegiada sem autorização, comprometimento completo do controle de acesso e possível acesso administrativo ao produto.

**Correção obrigatória:**

1. criar `RegisterDto` real com `class-validator` e apenas campos públicos permitidos;
2. ativar `forbidNonWhitelisted: true` globalmente, avaliando compatibilidade dos demais endpoints;
3. remover o spread do request na criação da entidade;
4. criar explicitamente `{ username, email, password: pwdHash, role: 'host', ativo: true }`;
5. adicionar teste HTTP que envie `role=admin`, `ativo=false` e campos arbitrários, exigindo rejeição `400` ou persistência forçada como `host/ativo`.

**Critério de fechamento:** request malicioso não cria nem modifica privilégios; teste consulta o registro persistido e confirma `role=host`.

---

### SEC-P1-02 — GET autenticado altera propriedade de outro tenant

**Severidade:** Alta  
**Classificação:** Contradito  
**Área:** Broken Access Control, IDOR/BOLA, semântica HTTP

**Evidência:**

- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts:86-125` expõe `GET /propriedades/airbnb/room-info`, protegido apenas por JWT, e aceita `propertyId` arbitrário.
- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts:130-149` repete o padrão para `room-basic-info` e `roomId`.
- `urban-ai-backend-main/src/propriedades/propriedade.service.ts:1334-1348` atualiza por `id_do_anuncio` sem filtrar o `userId` proprietário.
- `urban-ai-backend-main/src/propriedades/propriedade.service.ts:1402-1435`, `:1466-1474` e `:1507-1530` persistem dados obtidos do Airbnb durante essas chamadas.
- `urban-ai-backend-main/scripts/authorization-controls-audit.js:10-12` define como mutáveis apenas `POST`, `PUT`, `PATCH` e `DELETE`; `:162` ignora rotas que não sejam consideradas mutáveis; `:172-180` só então procura ownership checks.

**Impacto:** qualquer host autenticado que conheça o identificador público de um anúncio pode provocar alteração de dados pertencentes a outro host. O método `GET` também viola expectativa de operação segura/idempotente e pode ser acionado por prefetch, crawler ou cache.

**Correção obrigatória:** transformar a operação em `PATCH/POST` quando houver persistência, passar `req.user.userId` até o repositório e consultar por `{ id_do_anuncio, user: { id: userId } }`. Se a intenção for apenas consulta, remover toda persistência do fluxo.

**Teste obrigatório:** criar dois hosts e um anúncio do host A; chamar os dois endpoints como host B e exigir `404/403`, zero `UPDATE` e estado do anúncio inalterado.

---

### SEC-P1-03 — SSRF autenticado no resolvedor de URL

**Severidade:** Alta  
**Classificação:** Contradito  
**Área:** Input validation, rede interna, integração externa

**Evidência:**

- `urban-ai-backend-main/src/connect/connect.controller.ts:246-268` recebe `url` do usuário em `GET /connect/resolve`; a documentação menciona Airbnb, mas não há validação de host.
- `urban-ai-backend-main/src/connect/connect.service.ts:935-940` executa `fetch(shortUrl, { redirect: 'follow' })` sobre a URL arbitrária.

**Impacto:** um usuário autenticado de baixo privilégio pode forçar o backend a fazer requests para loopback, rede privada, link-local, metadata service ou endpoints internos, inclusive seguindo redirecionamentos. Isso permite probing, acesso indireto e possíveis efeitos colaterais internos.

**Correção obrigatória:** permitir somente `https`, validar hostname canônico contra allowlist exata de domínios Airbnb, resolver DNS e rejeitar IPv4/IPv6 privados/loopback/link-local, seguir redirects manualmente repetindo a validação a cada salto, limitar tempo/tamanho e nunca encaminhar credenciais.

**Teste obrigatório:** rejeitar `localhost`, `127.0.0.1`, `::1`, RFC1918, `169.254.169.254`, hostname que resolve para IP privado, redirect público→privado e host com sufixo enganoso como `airbnb.com.evil.tld`.

**Superfície secundária:** `urban-ai-backend-main/src/push/push-notification.service.ts:263-270` aceita qualquer endpoint `https`; `:305-320` realiza request ao endpoint armazenado. `urban-ai-backend-main/src/push/push.controller.ts:18-27` permite cadastrá-lo e `:41-52` disparar teste. Deve receber a mesma proteção contra IP privado, re-resolução e redirects, preferencialmente por biblioteca/provedor Web Push compatível.

---

### SEC-P1-04 — Rotação de refresh token vulnerável a corrida

**Severidade:** Alta  
**Classificação:** Contradito  
**Área:** Sessão, replay, concorrência

**Evidência:**

- `urban-ai-backend-main/src/auth/auth.service.ts:96-130` lê o token, verifica `revokedAt`, altera a entidade e salva antes de emitir o novo token, sem transação nem atualização condicional atômica.
- `urban-ai-backend-main/src/auth/auth.service.spec.ts:192-266` testa reutilização sequencial e expiração, mas não duas trocas concorrentes.

**Impacto:** duas requisições simultâneas podem observar `revokedAt = null` e ambas emitir novos tokens. Isso enfraquece a detecção de roubo/reuse e contradiz a afirmação pública de encerramento automático de sessões em reutilização simultânea.

**Correção obrigatória:** dentro de transação, executar `UPDATE ... SET revokedAt = ... WHERE id = ? AND revokedAt IS NULL` e emitir o sucessor somente se `affected = 1`. Se `affected = 0`, tratar como reuse e revogar toda a família. Registrar relação de família/substituição quando ainda não existir.

**Teste obrigatório:** duas trocas realmente concorrentes do mesmo refresh token; exatamente uma deve retornar sucesso, a outra `401`, e a política de revogação da família deve ser comprovada no banco.

---

### SEC-P2-05 — Validação runtime ausente em grande parte dos bodies

**Severidade:** Média, com manifestação crítica já comprovada no cadastro  
**Classificação:** Incompleto

Uma inspeção AST dos controllers encontrou **61 parâmetros `@Body`; apenas 21 usam classes DTO reconhecíveis em runtime e 40 usam tipos inline, `any` ou primitivas**. Exemplos incluem cadastro/login/perfil em `auth.controller.ts`, billing administrativo em `admin-billing.controller.ts:70,125`, Stays em `stays.controller.ts:31,74,91`, ingestão de eventos em `events-ingest.controller.ts:84` e portfólio em `portfolio.controller.ts:66,83`.

`whitelist: true` não protege bodies cujo `metatype` é `Object`. É necessário migrar todos os comandos para DTOs runtime, definir limites e formatos, ativar rejeição de campos desconhecidos e testar payloads excessivos, propriedades extras, coerção e valores de borda.

---

### SEC-P2-06 — Enumeração de conta e código de verificação fraco

**Severidade:** Média  
**Classificação:** Incompleto

**Evidência:**

- `urban-ai-backend-main/src/email/email.controller.ts:93-110` expõe endpoints públicos de estado/código.
- `urban-ai-backend-main/src/email/email.service.ts:152-160` retorna `{ ativo }`, distinguindo contas existentes.
- `urban-ai-backend-main/src/email/email.service.ts:171-177` retorna explicitamente “usuário não encontrado”.
- `urban-ai-backend-main/src/email/email.service.ts:188-205` gera código de seis dígitos com `Math.random` e o armazena em texto claro.
- `urban-ai-backend-main/src/email/email.controller.ts:140-147` limita por IP/processo, mas não foi encontrado ledger de tentativas por conta.
- `urban-ai-backend-main/src/app.module.ts:114-117` usa o storage padrão em memória do throttler; não foi encontrado storage distribuído.

**Correção:** respostas e timing indistinguíveis, `crypto.randomInt`, hash do código, limite e lockout por conta/finalidade, storage distribuído (por exemplo Redis) e teste de rate limit em múltiplas réplicas.

---

### SEC-P2-07 — Headers defensivos ausentes no frontend em produção

**Severidade:** Média  
**Classificação:** Contradito

**Evidência de código:** `Urban-front-main/next.config.ts:9-45` não define `headers()` e mantém exposição do framework.

**Evidência runtime em 2026-07-15:**

```text
curl.exe -sS -I https://myurbanai.com
curl.exe -sS -I https://app.myurbanai.com
```

Ambos responderam `200`, sem `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ou `Permissions-Policy`, e com `X-Powered-By: Next.js`.

O Helmet do backend em `urban-ai-backend-main/src/main.ts:26-49` não protege respostas do Next.js. Definir headers no Next/edge, desabilitar `poweredByHeader`, adotar CSP por nonce/hash e habilitar HSTS somente após garantir prontidão de todos os subdomínios.

---

### SEC-P2-08 — Secret scanning e saneamento de histórico não atendem SEC-02/SEC-03

**Severidade:** Média/Alta operacional  
**Classificação:** Contradito

O plano exige em `docs/plano-mestre-scorecard-10-10-2026-07-15.md:61-64` reescrita do histórico e Gitleaks/TruffleHog em pre-commit e CI.

**Evidência:**

- `.githooks/pre-commit:1-11` executa apenas `scripts/security-head-scan.js`.
- `.github/workflows/ci.yml:45-48` executa Gitleaks, mas não TruffleHog.
- `scripts/security-head-scan.js:15-24` cobre oito padrões específicos; `:26-34` examina arquivos correntes; `:113-138` testa somente esses padrões.
- `scripts/audit-sensitive-history.js:35-53` enumera caminhos em `git rev-list --objects --all`; `:86` declara que o conteúdo não é lido.

**Execuções:**

- `node scripts/security-head-scan.js` — PASS em 1.744 arquivos do HEAD.
- `node scripts/audit-sensitive-history.js --self-test` — 8/8 asserts PASS.
- `node scripts/audit-sensitive-history.js` — encontrou **11 referências históricas** em caminhos sensíveis, incluindo dumps SQL, PDF/texto de emails, scripts de extração e `credentials.py`.

Isso não prova que os objetos ainda contenham segredos ativos, pois o auditor deliberadamente não lê o conteúdo, mas contradiz o aceite objetivo de SEC-02 e não prova “zero segredo ativo”. É necessário scan de conteúdo do histórico em ambiente controlado, rotação coordenada, reescrita, invalidação de clones/forks/cache e instalação efetiva de Gitleaks/TruffleHog no pre-commit e CI.

---

### SEC-P2-09 — Gate LGPD aprova lacunas declaradas

**Severidade:** Média/Alta regulatória  
**Classificação:** Incompleto

**Evidência:**

- `urban-ai-backend-main/scripts/lgpd-controls-audit.js:66-71` conta como contratos aprovados frases documentais de que exportação, anonimização e retenção automatizada **não estão implementadas**.
- `docs/runbooks/lgpd-data-subject-requests.md:9,17-23,57-61` registra ausência de export real, anonimização, retenção automatizada, consentimento geral e drill.
- `docs/lgpd/politica-privacidade-interna.md:34,84-91,146-152,205` repete lacunas e registra DPO formal pendente.
- `Urban-front-main/src/app/(public)/landing/page.tsx:909-912` afirma “DPO designado”, contradizendo a política interna.
- `Urban-front-main/src/lib/legalContent.ts:24-26` informa corretamente que a designação formal está pendente.
- `Urban-front-main/src/lib/legalContent.ts:86-90` promete encerramento automático em reutilização simultânea de token, não garantido pela implementação concorrente atual.
- `Urban-front-main/src/lib/legalContent.ts:185` afirma TLS 1.3/AES-256 sem evidência runtime completa nesta auditoria.

O resultado `53/53` do gate prova consistência textual e alguns relacionamentos de cascade, não o aceite de SEC-04. Corrigir imediatamente claims públicos para refletir controles verificáveis; implementar exportação, anonimização, retenção, consentimento server-side e drill real com banco. Nomeação do DPO/encarregado e aprovação jurídica permanecem externas.

---

### SEC-P2-10 — Dependências e CI de segurança incompletos

**Severidade:** Média  
**Classificação:** Incompleto, com uma vulnerabilidade conhecida contradita

**Resultados locais:**

- `npm audit --omit=dev` em backend, frontend, dashboard e KNN: zero vulnerabilidades.
- `uvx pip-audit --path .venv/Lib/site-packages` no pipeline Python: nenhuma vulnerabilidade conhecida.
- o mesmo comando no webscraping: **1 vulnerabilidade conhecida**, `setuptools 80.10.2`, `PYSEC-2026-3447`, correção indicada em `83.0.0`.
- `urban-ai-scraping-main/pyproject.toml:37` permite `setuptools>=80.9`; o lock fixa `80.10.2` em `:1745-1750`.

**Lacunas CI:**

- `.github/workflows/ci.yml:43-48` audita npm apenas na raiz e executa Gitleaks.
- o job backend em `:65-96` não executa `npm audit`.
- o job frontend em `:172-190` não executa `npm audit`.
- os jobs Python em `:194-232` não executam `pip-audit`, Ruff ou mypy.
- dashboard/KNN executam audits em `:248-260`.
- não foi encontrado ZAP/DAST, Bandit ou `pip-audit` no CI.
- `.github/workflows/codeql.yml:1-43` existe, mas a execução remota e branch protection não foram certificadas nesta etapa.

Adicionar audits por workspace, `pip-audit`/SAST Python, DAST nightly contra staging isolado e políticas de falha. Atualizar/contornar a dependência vulnerável ou registrar exceção temporária com owner, prazo e mitigação.

---

### SEC-P2-11 — Erros de provider podem vazar detalhes ao cliente e logs

**Severidade:** Média  
**Classificação:** Incompleto

- `urban-ai-backend-main/src/propriedades/propriedade.controller.ts:121-125` e `:145-149` reenviam `error.response.data/status`.
- `urban-ai-backend-main/src/propriedades/propriedade.service.ts:1372-1378` e `:1394-1399` constroem exceções com resposta do provider.
- `urban-ai-backend-main/src/propriedades/propriedade.service.ts:1487-1489` e `:1535-1537` registram/repassam objetos de erro de integração.

Mapear erros externos para códigos internos allowlisted, retornar `correlationId`, registrar somente campos seguros e nunca corpo/headers/config completos de Axios. Testar que tokens, cookies, URLs assinadas, headers e corpo upstream não aparecem em resposta nem logs.

## 3. Matriz de requisitos auditados

| Requisito/controle | Estado | Evidência e parecer |
|---|---|---|
| SEC-01 — resposta a incidente de blobs | **Externo/Incompleto** | HEAD limpo pelo scanner local, mas tratamento de usuários, sessões, secrets, forks/cache e decisão ANPD exige coordenação e registros externos. |
| SEC-02 — reescrita de histórico | **Contradito** | auditor de paths encontrou 11 referências históricas; aceite exige ausência em `rev-list --objects --all`. |
| SEC-03 — Gitleaks/TruffleHog pre-commit e CI | **Contradito** | pre-commit usa scanner customizado; CI usa Gitleaks; TruffleHog ausente. |
| SEC-04 — retenção, consentimento, self-service e anonimização | **Incompleto** | documentação e próprio gate registram funções não implementadas; cascade audit passou, mas não cobre o requisito completo. |
| Cadastro e RBAC | **Contradito** | mass assignment permite `role=admin`. |
| Autorização/ownership | **Contradito** | GETs com persistência ignoram tenant; gate não examina GET. |
| Validação de inputs | **Incompleto** | 40/61 bodies sem DTO runtime; SSRF e mass assignment demonstram impacto. |
| CORS backend | **Comprovado em código / Externo em runtime** | `src/main.ts:51-71` usa allowlist explícita, credentials e fail-closed; DNS da API canônica impediu prova live completa. |
| Headers backend | **Comprovado em código** | Helmet configurado em `src/main.ts:26-49`. |
| Headers frontend | **Contradito** | headers ausentes em respostas live de `myurbanai.com` e `app.myurbanai.com`; `X-Powered-By` presente. |
| Tratamento seguro de erros | **Incompleto** | caminhos da integração de propriedades repassam/logam detalhes upstream. |
| Segredos no HEAD | **Comprovado pelo gate customizado** | scan local passou em 1.744 arquivos; cobertura de padrões é limitada. |
| Segredos no histórico | **Contradito/Inconclusivo quanto ao conteúdo** | 11 paths históricos; conteúdo não lido, portanto não há prova de segredo ativo nem de saneamento. |
| Dependências Node de produção | **Comprovado localmente** | quatro `npm audit --omit=dev` com zero vulnerabilidades no snapshot. |
| Dependências Python | **Contradito parcialmente** | pipeline limpo; webscraping contém `PYSEC-2026-3447`. |
| SAST/DAST/deps/secrets no CI | **Incompleto** | CodeQL e Gitleaks existem; faltam DAST, auditoria Python e audits em backend/frontend. |
| Observabilidade segura | **Comprovado em contrato / Externo em produção** | `audit:observability` passou 29/29; ingestão, redaction e alertas live não foram exercitados. |
| Backup/restore local | **Comprovado localmente** | `audit:resilience-dr` 65/65, backup self-test 6/6 e restore verify 6/6. |
| Backup/DR real e RPO/RTO | **Externo/Incompleto** | workflow realiza dump/checksum/upload, mas restore vazio real e postura de bucket existente/B2 não foram provados. |
| Stripe webhook | **Comprovado localmente / Externo distribuído** | raw body e assinatura existem; exactly-once multi-réplica, sandbox e replay operacional não foram certificados. |
| Stays token at rest | **Comprovado para novos writes / Externo para legado** | AES-GCM existe; leitura ainda aceita plaintext legado e não há prova de backfill completo no banco. |
| Readiness/API DNS | **Externo/Incompleto** | `api.myurbanai.com` não resolveu nesta auditoria; readiness autenticada e hostname canônico não foram certificados. |
| Zero P0/P1 aberto | **Contradito** | um achado crítico e três altos permanecem abertos. |

## 4. Controles que passaram e devem ser preservados

- `npm --prefix urban-ai-backend-main run audit:lgpd`: 53/53 contratos e 27 relações de `User` com política explícita `CASCADE/SET NULL`; o resultado deve ser interpretado dentro dos limites descritos neste relatório.
- `npm --prefix urban-ai-backend-main run audit:authorization`: 103 rotas mutáveis, 106 administrativas e 14 exceções públicas; ampliar para detectar efeitos colaterais em GET e ownership real.
- `npm --prefix urban-ai-backend-main run audit:observability`: 29/29.
- `npm --prefix urban-ai-backend-main run audit:cron:strict`: 21/21.
- `npm run audit:resilience-dr`: 65/65, com seis consultas de restore classificadas como read-only.
- `npm run backup:mysql:self-test`: 6/6.
- `npm run backup:mysql:restore:verify`: 6/6.
- CORS backend com allowlist e fail-closed; Helmet no backend; hash de senha e mecanismos locais de sessão devem ser preservados enquanto a atomicidade do refresh é corrigida.

## 5. Plano de remediação e testes

### Bloqueio imediato de release — P0/P1

1. **Cadastro:** eliminar mass assignment e adicionar regressão HTTP/DB.
2. **Tenant isolation:** bloquear persistência por `GET`, exigir ownership no repositório e adicionar teste com dois tenants.
3. **SSRF:** fechar resolvedor e endpoint Web Push; adicionar suíte de DNS/IP/redirect.
4. **Refresh:** tornar rotação atômica e testar corrida real.

Nenhum desses quatro itens deve ser aceito apenas por revisão estática; o fechamento exige teste automatizado reproduzindo o ataque.

### Curto prazo — P2

1. migrar os 40 bodies sem DTO runtime, com limites e rejeição de propriedades extras;
2. uniformizar respostas de email, usar RNG criptográfico, hash e rate limit distribuído por conta;
3. aplicar headers no frontend e verificar em produção;
4. corrigir exposição de erros de provider e testar redaction;
5. corrigir `PYSEC-2026-3447` e adicionar audits por workspace/Python ao CI;
6. instalar Gitleaks/TruffleHog no fluxo exigido e executar scan controlado de todo o histórico;
7. remover/corrigir claims públicos não comprovados de DPO, sessão, TLS/criptografia e backup.

### Certificação operacional — dependências externas

1. executar resposta coordenada ao incidente e registrar rotação, invalidação e decisão ANPD;
2. concluir exportação, anonimização, retenção, consentimento server-side e drill de titular;
3. verificar `api.*`, readiness autenticada, CORS e headers nos hostnames finais;
4. restaurar backup real em banco vazio, medir RPO/RTO e provar alertas;
5. verificar bucket existente quanto a criptografia, bloqueio público, versionamento, lifecycle e retenção, inclusive B2;
6. exercitar Stripe/Stays em sandbox, concorrência/replay multi-réplica e confirmar zero token Stays em plaintext sem exibir valores;
7. confirmar execuções remotas de CodeQL/CI, branch protection e DAST nightly.

## 6. Critério de reauditoria

Uma reauditoria pode declarar o domínio de segurança 10/10 somente quando:

- os quatro achados P0/P1 estiverem fechados com regressões reproduzíveis;
- SEC-01 a SEC-04 cumprirem literalmente os aceites do plano, sem gates que aprovam “não implementado”;
- não houver vulnerabilidade conhecida sem exceção formal e prazo;
- CI cobrir SAST, DAST, dependencies e secrets em todos os runtimes;
- claims públicos coincidirem com controles comprovados;
- restore, RPO/RTO, integrações e postura live tiverem evidência datada e auditável.

```yaml
report: "Seguranca, LGPD, SecOps e vulnerabilidades"
status: "reprovado_para_10_10"
release_blockers:
  critical: 1
  high: 3
classifications:
  comprovado: "controles locais especificos, conforme matriz"
  contradito: "SEC-02, SEC-03, auth/RBAC, tenant isolation, SSRF, refresh, headers frontend, Python dependency, zero P0/P1"
  incompleto: "SEC-04, inputs, email verification, erros, CI de seguranca, DR real"
  externo: "incidente/ANPD, runtime canônico, restore/RPO/RTO, sandbox multi-replica, owner e aprovacoes"
next_gate: "corrigir P0/P1 e repetir testes de ataque antes de release"
```
