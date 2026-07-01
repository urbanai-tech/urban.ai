---
name: run_command
description: Run safe local commands for diagnostics, tests, builds and repository checks.
description_pt-BR: Rodar comandos locais seguros para diagnósticos, testes, builds e checagens do repositório.
type: native
version: "1.0.0"
categories: [repository, diagnostics, testing, operations]
---

# Run Command

## Quando usar

Use esta capacidade quando um agente precisar executar comandos locais de diagnóstico, validação, build, teste, listagem ou inspeção.

## Instruções

- Prefira comandos somente-leitura ou comandos de validação.
- Antes de comandos que alteram arquivos, explique o objetivo e limite o escopo.
- Nunca rode comandos destrutivos sem aprovação explícita.
- Use o diretório de trabalho correto para cada serviço.
- Não imprima valores de segredos; em checks de ambiente, reporte apenas se a variável está presente ou ausente.
- Se `npm` não estiver disponível no PATH, use o Node local/bundled quando aplicável ou registre o bloqueio.

## Saída esperada

Informe:

- comando executado;
- resultado resumido;
- falhas acionáveis;
- arquivo de evidência gerado, quando houver.
