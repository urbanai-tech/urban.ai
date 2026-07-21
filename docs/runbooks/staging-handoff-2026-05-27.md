# Handoff de staging

**Origem:** 2026-05-27

**Atualizado em:** 2026-07-21

Este documento preserva o handoff histórico sem reproduzir valores TXT, tokens ou credenciais. Para o estado atual, consulte as evidências de staging em `docs/evidence/`.

## Base disponível

- backend e frontend possuem origins Railway de staging que respondem HTTP 200;
- configuração local usa `.env.staging`, ignorado pelo Git;
- health/readiness, Redis, MySQL, testes e gates possuem runbooks próprios;
- integrações externas devem usar sandbox/test e secrets armazenados no Railway/GitHub.

## Ordem operacional segura

1. Corrigir a região inválida do serviço canônico de frontend e confirmar que o deployment está saudável.
2. Reconfirmar no Railway a associação de `staging.myurbanai.com` sem criar um segundo domínio.
3. Aguardar a verificação e o certificado de `staging-api.myurbanai.com`.
4. Manter os registros existentes em DNS-only enquanto os certificados estiverem pendentes.
5. Validar TLS estrito, liveness, readiness autenticado, banner `STAGING` e E2E.
6. Configurar usuários admin/host e integrações sandbox por secret store.
7. Executar os gates enterprise e anexar evidências sem dados sensíveis.

## Estado em 2026-07-21

- `staging-api.myurbanai.com`: CNAME público, origin saudável, Railway ainda em `Waiting for DNS update` e TLS estrito inválido.
- `staging.myurbanai.com`: CNAME público e origin com banner `STAGING`, porém o serviço canônico aparece sem domínio público e com região `us-west2` inválida bloqueando deployments; TLS estrito inválido.
- `status.myurbanai.com`: GitHub Pages `built`, HTTP 200, sem certificado customizado e `https_enforced=false`.

Nenhum DNS deve ser recriado ou duplicado durante esse estado.

## Comandos após configurar secrets

```powershell
node scripts/opensquad-readiness-check.js
node scripts/enterprise-access-readiness.js --env-file .env.staging --output docs/evidence/enterprise-access-readiness-staging.md
node scripts/enterprise-auditability-live-gate.js --env-file .env.staging --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md
```

## Regras

- não copiar segredos ou valores de verificação para docs/logs;
- usar apenas chaves test/sandbox em staging;
- manter Stays em dry-run até smoke e rollback aprovados;
- não executar mutações em produção;
- qualquer aplicação real de preço exige aprovação humana e rollback testado.
