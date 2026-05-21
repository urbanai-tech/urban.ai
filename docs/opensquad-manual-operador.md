# Manual rápido do Opensquad para operador

Este manual é para quem precisa usar o Opensquad sem conhecer a parte técnica. Pense nele como uma mesa de trabalho com equipes de IA: cada equipe tem agentes com funções diferentes e um passo a passo salvo.

## O que dá para fazer

- Criar uma equipe de IA a partir de uma descrição simples.
- Rodar uma equipe já criada para gerar entregas, relatórios ou auditorias.
- Pausar em pontos de confirmação antes de seguir.
- Ver e ajustar equipes existentes.
- Guardar aprendizados para melhorar as próximas execuções.

## Comandos mais usados

| Comando | Quando usar |
|---|---|
| `/opensquad` | Abrir o menu principal |
| `/opensquad create <o que você precisa>` | Criar uma nova equipe |
| `/opensquad list` | Ver equipes existentes |
| `/opensquad run <nome>` | Rodar uma equipe pronta |
| `/opensquad edit <nome> <mudança>` | Pedir ajuste em uma equipe |
| `/opensquad help` | Ver ajuda |

## Como rodar uma equipe pronta

1. Digite `/opensquad list` para ver os nomes disponíveis.
2. Digite `/opensquad run <nome-da-equipe>`.
3. Leia os avisos de início: número de passos, agentes envolvidos e pasta de saída.
4. Quando aparecer um ponto de confirmação, revise o arquivo indicado antes de responder.
5. Ao final, confira a pasta `squads/<nome>/output/<data-da-execucao>/`.

## Como pedir uma equipe nova

Descreva o resultado desejado com palavras normais. Bons exemplos:

- "Criar uma equipe que audite o painel de operação e gere uma lista de problemas por prioridade."
- "Criar uma equipe que pesquise eventos em São Paulo e sugira oportunidades para anfitriões."
- "Criar uma equipe que transforme uma reunião em plano de ação para produto."

O Opensquad deve fazer perguntas curtas, uma por vez. Se a pergunta vier técnica demais, responda com o que souber e peça para simplificar.

## Checklist antes de aprovar uma entrega

- O arquivo indicado existe e tem conteúdo.
- O texto está no idioma esperado.
- O resultado responde ao pedido original.
- Não há dado sensível, senha ou token no conteúdo.
- As próximas ações estão claras para uma pessoa de operação.

## Quando chamar alguém técnico

- A execução diz que faltou arquivo, credencial, capacidade ou configuração.
- O mesmo passo falha duas vezes.
- A equipe quer apagar arquivos ou mudar integração.
- A entrega depende de produção, cobrança, LGPD ou dados reais de cliente.

## Dicionário rápido

| Termo técnico | Como entender |
|---|---|
| Squad | Equipe de IA |
| Agent | Agente com uma função |
| Pipeline | Fluxo passo a passo |
| Checkpoint | Ponto de confirmação |
| Skill | Capacidade extra da equipe |
| Output | Arquivo entregue |
| Run | Execução feita em uma data/hora |
