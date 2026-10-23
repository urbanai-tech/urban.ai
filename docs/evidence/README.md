# Evidências

Evidência de execução (gates, smoke, restore drill, release evidence) é **produzida como artefato de CI** e não é versionada neste repositório. Os workflows `release-gate.yml` e `restore-drill.yml` publicam os relatórios como artefatos de execução (retenção definida no workflow).

Para gerar evidência localmente, os scripts escrevem Markdown nesta pasta (conteúdo ignorado pelo Git, exceto este README):

```sh
node scripts/release-evidence.js --dry-run                                  # prévia sem escrever arquivo
node scripts/release-evidence.js --output docs/evidence/release-evidence.md
node scripts/enterprise-auditability-live-gate.js --env=staging --strict --output docs/evidence/enterprise-live-gate-staging.md
node scripts/enterprise-access-readiness.js --output docs/evidence/enterprise-access-readiness.md
```

O gerador de release evidence coleta SHA, branch, remotos, status da árvore e metadados do GitHub CLI quando disponível; não lê variáveis de ambiente nem conteúdo de arquivos e mascara credenciais de remotos e formatos comuns de token.

Regras:

- Nunca registrar valores de segredos; use relatórios de presença/ausência e acesso pelo provedor.
- Toda aprovação de controle precisa de data, ambiente, SHA/branch, comando ou procedimento manual, resultado observado e risco residual. Alterar docs ou código não aprova controle.
- Casos, benchmarks, ROI e comparações em páginas públicas seguem [`../runbooks/seo-case-evidence-framework.md`](../runbooks/seo-case-evidence-framework.md).
