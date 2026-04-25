# Atualização de Roadmap — Ricardo Roadmap

**Run:** 2026-04-21-175845
**Arquivo alterado:** `docs/roadmap-pos-sprint.md` (v2.0 → v2.1)

## O que foi feito

1. Atualizado o cabeçalho do roadmap de **v2.0 (13/04/2026)** para **v2.1 (21/04/2026)** com bloco explicativo sobre o ciclo de auditoria.
2. **Nenhum item `⬜` promovido a `✅`** — respeito estrito à regra do step-02 do Vitor (evidência técnica exigida a 100%). Itens seguem como estavam.
3. Criada nova seção **F5B — Entregas Extras · Sprint 07–21/04/2026** com a matriz completa das 7 entregas (E1–E7) identificadas pela auditoria, incluindo:
   - ID, descrição da entrega, caminho da evidência no repo e data aproximada.
   - Nota explícita de dívida técnica (ausência de testes nos módulos novos).
4. Adicionada tabela de **Changelog do Roadmap** ao final do documento para manter a trilha de versões auditada.

## Itens que permanecem `⬜` com ressalva

Estes itens aparecem no relatório do Vitor como flagrados — **não foram tocados** aqui pois não passaram no critério de evidência. Lista mantida para que Daniela saiba o que documentar como risco:

- F5A.1: login Google OAuth — edge cases sem cobertura de teste
- F5A.2: checklist de setup de perfil, tooltip no dashboard, sequência D1/D3/D7 de onboarding
- F5A.3: upload de fotos, validação imediata no dashboard
- F5A.5: teste em produção bloqueado por KYC Stripe 🔄
- F6.1: expor REST KNN + dados reais — zero mudança no repo KNN neste sprint
- F6.3: painel admin básico — zero arquivos novos

## Regras aplicadas

- Preservada a estrutura, indentação e legendas (✅ / 🔄 / ⬜ / 🔴 / 💰) do roadmap original.
- Nenhum item foi removido.
- Nenhum item foi marcado como `[x]` sem Vitor ter confirmado evidência técnica sólida.
