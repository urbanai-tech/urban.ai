# Runbook - beta fechado assistido

Data: 2026-05-14
Escopo: operar o beta fechado com 5-10 anfitrioes reais sem promessa quantitativa publica antes de recomendacoes, dataset e cases terem evidencia.

## Objetivo

Validar se a Urban AI gera decisao util para anfitrioes em Sao Paulo/Grande SP, com acompanhamento humano, registro de preco aplicado e relatorio semanal. O beta nao e campanha aberta nem beta pago publico.

## Perfil de participante

Priorize anfitrioes que atendam pelo menos 4 criterios:

- 1 a 10 imoveis ativos em Sao Paulo ou Grande SP.
- Aceita feedback semanal por WhatsApp, e-mail ou chamada curta.
- Consegue informar preco aplicado e resultado da reserva.
- Usa Airbnb, Booking ou Stays, mas aceita operar manualmente se Stays nao estiver pronto.
- Tem calendario/preco atual minimamente organizado.
- Entende que recomendacao e apoio a decisao, nao garantia de ocupacao ou ROI.

Evite no primeiro lote:

- imoveis fora da cobertura de eventos;
- gestores com dezenas de unidades sem suporte dedicado;
- usuario esperando automacao total imediata;
- conta sem disponibilidade para feedback.

## Gates antes de convidar

Antes de chamar participantes:

- M1/waitlist testado com pelo menos 5 leads de teste.
- Eventos com `next30d >= 100` ou fallback manual ativo.
- Smoke de recomendacao nova executado ou agendado para o primeiro imovel.
- Smoke de dataset/ground truth pronto para registrar preco aplicado.
- Copy publica sem promessa quantitativa.
- Canal de suporte definido.
- Responsavel por acompanhar cada participante definido.

## Onboarding assistido

Para cada participante:

1. Registrar origem: referral, orgânico, campanha, parceiro ou convite direto.
2. Confirmar consentimento de beta e uso assistido dos dados.
3. Criar/validar usuario e imoveis.
4. Conferir cidade, endereco, coordenadas e preco base.
5. Rodar geocoder se houver endereco incompleto.
6. Rodar smoke de recomendacao nova para pelo menos 1 imovel elegivel.
7. Explicar limites: eventos cobertos, modo manual, Stays beta privado, sem promessa de ROI.
8. Combinar cadencia de feedback: semanal e pontual quando uma recomendacao for aplicada.
9. Registrar primeira evidencia no template abaixo.

## Rotina semanal

Toda semana, para cada participante ativo:

- quantidade de imoveis cadastrados;
- imoveis com recomendacao futura;
- recomendacoes novas na semana;
- recomendacoes aceitas, rejeitadas e aplicadas;
- preco recomendado vs. preco aplicado;
- reservas/ocupacao informadas;
- bugs ou friccoes;
- proximas acoes.

Se uma semana tiver recomendacoes zeradas para todos os participantes, bloquear ampliacao do beta e voltar para F2/F3.

## Template de relatorio semanal

```text
Relatorio semanal beta fechado
Semana:
Responsavel:
Participantes ativos:
Imoveis ativos:
Eventos next30d:
Recomendacoes novas:
Imoveis com recomendacao futura:
Aceitas:
Rejeitadas:
Preco aplicado registrado:
Snapshots gerados:
Reservas/ocupacao informadas:
Top 3 aprendizados:
Top 3 bugs/friccoes:
Decisao: manter/ampliar/bloquear
Pendencias:
```

## Template de case

Um case so pode ser usado publicamente depois de revisao e aprovacao. Antes disso, trate como evidencia interna.

```text
Case beta Urban AI
Participante:
Periodo:
Perfil do imovel:
Fonte dos dados:
Contexto inicial:
Evento/recomendacao:
Preco anterior:
Preco recomendado:
Preco aplicado:
Resultado observado:
O que a Urban AI influenciou:
O que nao pode ser atribuido a Urban AI:
Evidencias:
Autorizacao para uso publico? sim/nao
Revisao juridica/copy? sim/nao
```

## Criterios de sucesso para M2

M2 pode avancar quando:

- 5-10 anfitrioes estao ativos ou com onboarding agendado;
- pelo menos 3 imoveis tem recomendacoes novas recentes;
- pelo menos 1 preco aplicado foi registrado;
- o relatorio semanal existe;
- bugs P0/P1 do fluxo assistido estao triados;
- participantes entendem o modo manual/assistido.

## Criterios para nao ampliar

Nao amplie o beta quando:

- eventos futuros estao abaixo do gate e sem fallback;
- recomendacoes novas nao aparecem;
- usuario nao consegue registrar preco aplicado;
- admin nao consegue explicar motivo de falta de recomendacao;
- suporte esta manual demais para o numero atual de participantes;
- existe risco de promessa quantitativa sem case aprovado.

## Saida esperada

Depois de 2 semanas:

- decidir se o beta continua, amplia ou pausa;
- listar os 3 principais bloqueios de produto;
- escolher ate 3 cases candidatos;
- alimentar F2/F3/F4 com dados reais;
- manter M3 bloqueado ate billing, suporte e cases estarem prontos.
