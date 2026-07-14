---
name: mcp_railway
description: Inspect Railway deployment and environment state through an available Railway connector or provided evidence.
description_pt-BR: Inspecionar estado de deploy e ambiente Railway por conector disponível ou evidência fornecida.
type: native
version: "1.0.0"
categories: [railway, deploy, operations, diagnostics]
---

# Railway Operations

## Quando usar

Use esta capacidade quando uma equipe precisar conferir deploys, serviços, ambientes, logs, status de build ou readiness relacionados ao Railway.

## Instruções

- Se houver conector Railway disponível, use-o em modo leitura antes de qualquer ação mutável.
- Se o conector não estiver disponível, use evidências locais, runbooks, logs exportados ou informações fornecidas pelo usuário.
- Não crie ambientes, serviços ou recursos pagos sem aprovação explícita.
- Não liste nem copie valores de variáveis secretas. Registre apenas presença/ausência, ambiente e nome da variável.
- Trate produção como sensível: qualquer smoke com escrita deve exigir staging ou autorização humana explícita.

## Saída esperada

Entregue:

- serviços/ambientes observados;
- status de deploy/readiness;
- variáveis ausentes por nome, sem valores;
- bloqueios e próximos passos seguros.
