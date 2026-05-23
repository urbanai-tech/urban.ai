---
execution: parallel
outputFile: squads/event-demand-pricing-radar/output/trabalho-paralelo.md
---

# Trabalho paralelo

Executar os 5 agentes em paralelo usando os task files de cada agente.

Regra:

- cada agente respeita seu ownership;
- cada agente salva um resumo de handoff;
- nenhum agente reverte alteracoes alheias;
- mocks devem ser marcados claramente para remocao na fase de integracao.
