---
name: read_files
description: Read repository files and summarize relevant local context for a squad.
description_pt-BR: Ler arquivos do repositório e resumir contexto local relevante para uma equipe.
type: native
version: "1.0.0"
categories: [repository, research, operations]
---

# Read Files

## Quando usar

Use esta capacidade quando um agente precisar consultar arquivos locais do projeto, comparar documentação, revisar código, ler logs já salvos ou validar se um artefato existe.

## Instruções

- Leia apenas os arquivos necessários para o passo atual.
- Prefira buscas por `rg`/`rg --files` antes de abrir muitos arquivos.
- Preserve caminhos técnicos exatamente como aparecem no repositório.
- Não exponha segredos caso apareçam em arquivos locais; relate apenas presença/ausência ou o nome da variável.
- Quando houver conflito entre documentos, priorize evidências, runbooks e roadmaps mais recentes.

## Saída esperada

Entregue um resumo objetivo com:

- arquivos consultados;
- fatos encontrados;
- lacunas ou riscos;
- próximos passos recomendados.
