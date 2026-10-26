# ADR 0011 — Repositório público canônico com escopo por allowlist

**Status:** Aceito (26/10/2026) — registra o que já vigora.

## Contexto

O código e a documentação vivem num repositório **público** (`urbanai-tech/urban.ai`). Isso traz transparência e CI gratuito, mas qualquer arquivo publicado fica no histórico para sempre: um commit novo não apaga o anterior (ver [`postmortems/incident-git-leak-2026-07.md`](../postmortems/incident-git-leak-2026-07.md)). Mudanças também chegam de outros ambientes de trabalho por patch (commits `chore(sync)` no histórico), e é fácil um arquivo que não deveria ser público vir junto.

## Opções consideradas

1. **Denylist** (bloquear o que sabemos ser sensível). Exige nomear o sensível, e o que não foi previsto passa.
2. **Revisão manual em cada PR.** Não escala e falha no cansaço.
3. **Allowlist em script, aplicada por hook e por CI** (escolhida): só entra o que está explicitamente permitido.

## Decisão

- O repositório público é a **fonte da verdade do código**: CI, CodeQL, backup e restore drill rodam nele, e toda mudança entra por Pull Request (`CONTRIBUTING.md` §6).
- O escopo é uma **allowlist** em `scripts/public-scope-guard.js`: arquivos de raiz, pastas de raiz, `scripts/` (lista fechada) e `docs/` (diretórios e arquivos individuais). Qualquer outro caminho é rejeitado, sem que o script enumere o que é interno. Roda com `npm run gate:public-scope` (há `--self-test`).
- O hook `.githooks/pre-push` (instalado por `npm run hooks:install`) verifica a **árvore de cada commit enviado** ao remoto público, usando o guarda do próprio commit, e bloqueia o push se algo estiver fora do escopo. O `pre-commit` roda o scanner de segredos (`scripts/security-head-scan.js`).
- Arquivo novo em `scripts/` ou em `docs/` fora das pastas já permitidas exige atualizar a allowlist de forma consciente, no mesmo PR.

## Consequências

- (+) Vazamento por esquecimento deixa de depender de memória humana; o erro aparece antes do push.
- (+) Quem chega entende o limite: "se não está na allowlist, não é público".
- (−) Todo documento ou script novo fora das pastas permitidas custa uma edição na allowlist (atrito intencional).
- (−) O hook só protege quem o instalou; o gate de CI é a segunda barreira.
- (−) Segredos já publicados não são desfeitos por nenhum desses guardas: exigem rotação.
