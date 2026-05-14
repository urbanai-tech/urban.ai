# Runbook - suporte e LGPD para beta pago

Data: 2026-05-14
Escopo: definir o minimo operacional de suporte, privacidade e governanca antes de cobrar clientes em beta pago.

## Principio

M3 nao deve avancar se o time nao consegue responder a duas perguntas simples:

- quem atende o cliente quando algo quebra?
- como respondemos uma solicitacao LGPD dentro do prazo?

## Canais minimos

Antes de beta pago:

- e-mail de suporte ativo;
- e-mail de privacidade ativo: `privacidade@myurbanai.com`;
- responsavel primario e substituto definidos;
- planilha, Linear, Notion ou ferramenta simples para registrar tickets;
- processo para bugs P0/P1 chegar ao time tecnico no mesmo dia.

## Severidade de suporte

| Severidade | Exemplo | Resposta alvo | Acao |
|---|---|---:|---|
| P0 | Login indisponivel, checkout cobrando errado, vazamento de dado, push Stays indevido | 2h uteis | Pausar feature/deploy e abrir incidente. |
| P1 | Recomendacoes zeradas para cliente ativo, webhook Stripe divergente, job admin falhando | 1 dia util | Triar com dono tecnico e comunicar workaround. |
| P2 | Duvvida de uso, ajuste de cadastro, bug visual sem impacto financeiro | 2 dias uteis | Resolver no suporte ou backlog. |
| P3 | Sugestao de melhoria | Sem SLA | Agrupar para roadmap. |

## Solicitacoes LGPD

Pedidos de acesso, correcao, exclusao, portabilidade ou revogacao devem ser registrados com:

- data/hora de recebimento;
- canal;
- identidade/e-mail do titular;
- tipo de solicitacao;
- prazo maximo de resposta;
- responsavel;
- status;
- evidencia da resposta.

Prazo operacional: responder em ate 15 dias corridos, conforme politica interna.

## Passo a passo LGPD

1. Confirmar identidade do solicitante pelo e-mail da conta.
2. Classificar o pedido: acesso, correcao, exclusao, portabilidade, revogacao, outro.
3. Registrar ticket com prazo.
4. Exportar ou localizar dados pessoais relevantes: conta, perfil, imoveis, recomendacoes, pagamentos, consentimentos e logs auditaveis.
5. Validar se ha obrigacao legal/contratual que impede exclusao imediata de algum registro.
6. Responder ao titular em linguagem simples.
7. Registrar evidencia da resposta.
8. Se houver exclusao, confirmar que integracoes externas foram desconectadas quando aplicavel.

## Checklist DPA/subprocessadores

Antes de beta pago, o responsavel legal deve atualizar `docs/lgpd/dpa-checklist.md` e `docs/lgpd/politica-privacidade-interna.md` com:

- Stripe;
- MailerSend ou provedor de e-mail ativo;
- Railway;
- AWS/S3;
- Upstash/Redis;
- Sentry;
- Google/Maps/OAuth;
- Stays, se houver conta real conectada;
- prestadores com acesso operacional.

Se um DPA nao estiver assinado, registrar risco aceito ou manter o fluxo limitado ao beta gratuito/manual.

## Consentimentos minimos

Antes de M3:

- termos aceitos com versao/data;
- politica de privacidade publicada e revisada;
- cookies/analytics gateados por consentimento;
- comunicacoes de marketing opt-in/opt-out;
- Stays com consentimento explicito antes de conectar token real;
- consentimento de case separado se houver uso publico de depoimento, numero ou logo.

## Suporte durante beta pago

Rotina diaria:

- revisar tickets abertos;
- conferir `/admin/dashboard`;
- conferir webhooks Stripe;
- conferir alertas Sentry;
- conferir se ha recomendacoes zeradas para cliente pago;
- registrar pendencias criticas no roadmap/backlog.

Rotina semanal:

- revisar top bugs e friccoes;
- revisar pedidos LGPD;
- revisar cancelamentos e motivos;
- revisar cases candidatos;
- atualizar relatorio de beta.

## Registro de evidencia

```text
Readiness suporte/LGPD
Data:
Responsavel:
Canal suporte ativo:
Canal privacidade ativo:
Ferramenta de tickets:
P0/P1 owner:
DPAs revisados:
Termos/privacidade revisados:
Consentimentos versionados:
Pedidos LGPD em aberto:
Resultado: aprovado/bloqueado
Pendencias:
```

## Criterios de saida para M3

M3 pode avancar quando:

- canais de suporte e privacidade funcionam;
- P0/P1 tem dono e resposta alvo;
- termos/privacidade foram revisados para beta pago;
- DPAs prioritarios estao assinados ou com risco formal;
- consentimentos criticos tem versao/data ou tarefa bloqueadora;
- existe registro simples de tickets e pedidos LGPD.

M3 deve ficar bloqueado quando:

- cliente pago nao tem canal claro de suporte;
- privacidade@ nao recebe e-mail;
- Stays usa token real sem consentimento auditavel;
- checkout/billing ativo sem processo de contestacao/cancelamento;
- nao ha dono para responder pedido LGPD.
