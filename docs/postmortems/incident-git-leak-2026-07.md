# Incidente — Dump de produção no histórico do git (2026-07)

**Severidade:** P0 (vazamento de dados pessoais + credenciais)
**Detecção:** auditoria LGPD de 02/07/2026.
**Status:** contenção parcial (código); ações de conta/histórico pendentes do owner.

## O que aconteceu

Os arquivos abaixo estavam versionados e rastreados no git desde o commit `476958f`
(02/04/2026), em repositório `github.com/Gustavogm9/urban.ai`:

- `docs/dump-ai_urban-202603131344.sql` — dump completo do banco de produção (13/03/2026)
- `docs/inserts-only.sql`, `docs/inserts-only-cols.sql` — derivações do dump
- `docs/Emails Urban AI.pdf`, `docs/emails_pdf_content.txt` — threads de e-mail com PII

Conteúdo: ~80 usuários com e-mail + hash de senha (**68 em SHA-256 sem salt**), ~19 endereços
residenciais com lat/lng, ~54 pagamentos com `customerId`/`subscriptionId` Stripe reais.

## Contenção já aplicada (nesta branch)

- [x] Padrões adicionados ao `.gitignore` (`*.pdf`, `docs/Emails*.pdf`, `docs/emails_pdf_content.txt`; `*.sql` já existia).
- [x] `git rm --cached` dos 5 arquivos (removidos do HEAD; **ainda presentes no histórico**).

## Ações PENDENTES — exigem o owner (não executáveis automaticamente)

- [ ] **Confirmar visibilidade do repo.** Se público, tornar privado imediatamente (GitHub → Settings → Danger Zone).
- [ ] **Rotacionar credenciais:** forçar reset de senha dos ~80 usuários + invalidar `refresh_token`. As 68 SHA-256 são consideradas comprometidas.
- [ ] **Rotacionar chave Stripe `sk_live_`** citada em `docs/archive/reports/relatorio-testes-2026-03-18.md` (gerar nova, atualizar `STRIPE_SECRET_KEY` no Railway, revogar antiga).
- [ ] **Reescrever histórico** (remove de fato os blobs — o `git rm --cached` acima não faz isso):
  ```
  git filter-repo --path docs/dump-ai_urban-202603131344.sql \
    --path docs/inserts-only.sql --path docs/inserts-only-cols.sql \
    --path "docs/Emails Urban AI.pdf" --path docs/emails_pdf_content.txt --invert-paths
  git push --force origin --all && git push --force --tags
  ```
  Avisar todos os colaboradores para re-clonar (SHAs mudam; atenção às branches `codex/*`).
  Abrir ticket no GitHub Support para expurgar cache/forks.
- [ ] **Compliance:** registrar RIPD e avaliar comunicação à ANPD (art. 48 LGPD) conforme `docs/lgpd/politica-privacidade-interna.md`.

## Prevenção

- `.gitignore` reforçado.
- Recomendado: hook de pre-commit que bloqueia `*.sql`/`*dump*` e um scan de secrets no CI.
