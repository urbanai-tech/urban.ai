# Inventário e classificação dos DOCX legados

**Data da triagem:** 2026-07-15  
**Status:** arquivo histórico; não usar como fonte operacional atual.  
**Método:** hash SHA-256 e extração estruturada com `python-docx`. Não existem duplicatas binárias exatas. O LibreOffice não estava disponível para renderização visual em lote; portanto, a classificação considera conteúdo e metadados, não fidelidade de layout.

## Fonte atual

- estado do sistema: `../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`;
- plano vigente: `../../plano-mestre-scorecard-10-10-2026-07-15.md`;
- arquitetura, produto, jornadas e design: `../../product/`;
- operação: `../../runbooks/` e `../../handoff/`.

## Pacote técnico arquivado

`urban-ai-documentacao/` contém 32 entregáveis Word numerados. O pacote descreve uma arquitetura anterior, incluindo operação on-premise e backend FastAPI como principal, e foi substituído pelas fontes Markdown acima. Ele permanece preservado apenas para rastreabilidade histórica.

## Relatórios e planos arquivados

`reports-plans/` preserva relatórios de sócios/status, roadmaps e tutorial de testes já superados. Métricas e afirmações desses arquivos não representam o estado atual.

## Revisão de privacidade

`restricted-review/` contém material que descreve pessoas e relações de trabalho. O arquivo continua no histórico Git; a movimentação não equivale a anonimização. Owner e jurídico devem decidir retenção, base legal, acesso e eventual remoção coordenada do histórico.

## DOCX mantidos fora do arquivo

- `../../legal/politica-privacidade-urban-ai-2026-05-11.docx`;
- `../../legal/termos-de-uso-urban-ai-2026-05-11.docx`;
- `../../lgpd/BRIEFING COMPLETO - Urban AI.docx`.

Esses três arquivos são originais jurídicos/de briefing, não documentação técnica. Sua validade material ainda depende de aceite jurídico e versionamento formal.
