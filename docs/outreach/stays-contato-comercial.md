# Stays — Roteiro de Contato Comercial
**Objetivo:** abrir o canal com a Stays em até 5 dias úteis e agendar uma reunião de 30 min. Este documento é o roteiro operacional — as mensagens são prontas para copiar e enviar.

---

## Dados da contraparte (pesquisa 22/04/2026, confirmar antes de enviar)

- **Empresa:** Stays S.A. (stays.net) — Preferred+ Software Partner Airbnb LATAM, Booking Premier, Expedia Preferred, Vrbo Connected, Decolar Premium
- **Sede:** Rua Siqueira Campos, 43, Cobertura 01, Copacabana, Rio de Janeiro — CEP 22031-070
- **CNPJ:** 26.210.199/0001-76
- **Tamanho:** 99 colaboradores, atuação em 18+ países
- **WhatsApp comercial:** +55 21 96706-9723
- **Site de agendamento direto:** https://cloud.email.stays.net/marcar-conversa
- **LinkedIn empresa:** https://br.linkedin.com/company/stays-net
- **CEO:** Sven dos Santos (alemão, radicado no RJ desde 2004)
- **Co-fundadores:** Till Pupak, Sergey Korotkov

> ⚠️ Antes de enviar qualquer mensagem, revalidar no site oficial (stays.net/sobre) se Sven ainda é CEO e se o WhatsApp acima continua sendo o canal comercial. Pesquisa pode ter ficado desatualizada.

---

## Sequência recomendada (3 etapas, 5 dias úteis)

### Dia 1 — WhatsApp comercial (entrada rápida)

Mensagem curta, sem one-pager anexo ainda. Objetivo: confirmar canal e pedir o contato certo.

```
Olá, sou Gustavo Macedo, fundador da Urban AI — plataforma de IA para otimização
de receita de anfitriões Airbnb, focada em São Paulo.

Acompanho a Stays há um tempo, e a posição de vocês como único Preferred+ Partner
do Airbnb na América Latina chama atenção. Temos interesse em conversar sobre uma
possível colaboração onde nossa IA de precificação seria oferecida a clientes
Stays como piloto — ganho para o cliente final, pouca fricção operacional para
a Stays.

Consegue me indicar com quem eu posso conversar sobre isso? Posso mandar um
one-pager antes se preferir.

Obrigado,
Gustavo
```

Se houver resposta pedindo detalhes, **enviar imediatamente** o `stays-one-pager.md` (converter para PDF antes de anexar — pode usar qualquer exportador Markdown → PDF, ou o Canva/Google Docs).

### Dia 2 — LinkedIn InMail para Sven dos Santos (paralelo ao WhatsApp)

Apenas se o WhatsApp não tiver retornado em 24h, para diversificar canais. Mensagem um pouco mais formal.

**Assunto:** `Proposta de piloto — Urban AI (IA de precificação) para clientes Stays`

```
Olá Sven, tudo bem?

Sou Gustavo Macedo, fundador da Urban AI — plataforma brasileira de IA para
otimização de receita de anfitriões Airbnb (promessa: +30% via IA, foco inicial
SP).

Estamos em fase de abrir um beta fechado com 5–10 anfitriões profissionais e
queria propor à Stays um piloto conjunto: Urban AI grátis por 3 meses para até
10 clientes que a Stays indicar, em troca de acesso a um dataset agregado
anonimizado de preço/ocupação por bairro (sem PII, sem nada re-identificável).

Sem contrato comercial, sem exclusividade — só um memorando de confidencialidade
simples de 1 página. Se após o piloto houver valor claro pros clientes de vocês,
conversamos sobre uma estrutura de longo prazo (revenue share).

Pode me indicar a pessoa certa do time de vocês para uma conversa de 30 min?
Segue um one-pager em PDF com o detalhamento.

Obrigado,
Gustavo Macedo
gustavog.macedo16@gmail.com
```

### Dia 3–4 — Agendamento direto (se o canal comercial redirecionou)

Se no WhatsApp responderam "agende pelo site", usar https://cloud.email.stays.net/marcar-conversa. Escolher "Partnerships" ou "Integrações" se existir; senão "Comercial — outras demandas". Na descrição da reunião: referenciar o one-pager e o ID da conversa do WhatsApp se houver.

### Dia 5 — Follow-up

Se nenhuma resposta em 5 dias úteis:

```
Oi, só reavivando o contato — segue meu pedido acima. Entendo que vocês devem
receber muitos desses; se fizer mais sentido eu entrar no formulário de partner
do site de vocês, me avisa o link. Se não for prioridade agora, sem problema —
me avise só para eu recalibrar o plano desse lado. Obrigado!
```

Se **não houver retorno em 10 dias úteis**, pivotar:
1. Abordar a **Seazone** (>2.000 imóveis no Brasil) com mesma proposta.
2. Em paralelo, iniciar prospecção da comunidade Superhost SP direto (grupos de Facebook, Telegram, Airbnb Community).
3. Manter contato Stays como "dormente" — reabrir após 90 dias se tiver tração.

---

## Anexos a enviar junto

- `docs/outreach/stays-one-pager.md` — converter para PDF branded (paleta Urban AI: laranja `#ef7d5a`, azul `#232f53`)
- (Opcional) link curto para uma URL demo privada da plataforma — idealmente `app.myurbanai.com` com uma conta demo pré-configurada

## Antes da reunião — checklist

Se conseguirmos a reunião, temos que chegar com respostas para estas perguntas (Stays vai perguntar, estar preparado evita 2 rodadas):

1. **Quantos clientes vocês têm hoje pagantes?** → honestidade: estamos em beta fechado, 0 pagantes ainda
2. **Qual o perfil do cliente-alvo?** → PMCs pequenos/médios e Superhosts com 3+ imóveis
3. **Por que SP primeiro?** → maior mercado LATAM de Airbnb após RJ, rede de eventos densa (diferencial do motor), time local
4. **Stack técnica?** → NestJS monolito + MySQL Railway + KNN nativo + Prefect + S3
5. **E se o Airbnb mudar de API?** → nossa integração via Stays Open API isola esse risco (é exatamente por isso que estamos aqui)
6. **Qual o valor para a Stays continuar após o piloto?** → 3 cenários: revenue share (Modelo 2), add-on white-label (Modelo 3), data commons (Modelo 4) — todos no doc de estratégia
7. **O que vocês pedem de nós?** → integração técnica 100% do nosso lado, SLA 24h em incidentes piloto, relatório quinzenal

## Pontos a NÃO mencionar na primeira conversa

- KYC Stripe ainda não aprovado (não é problema deles)
- Questões de hardening técnico (mesmo motivo)
- Dificuldades com Lumina Lab (fica entre nós)
- Números de CAC/ARR ainda hipotéticos (esperar dados reais)

---

## Rastreamento deste contato

Criar entrada no CRM / tabela de pipeline assim que a primeira resposta chegar. Campos mínimos:
- Data do primeiro contato
- Canal (WhatsApp / LinkedIn / site)
- Contraparte que respondeu
- Status (aguardando, reunião marcada, no-show, piloto em andamento, descartado)
- Próxima ação e data

*Urban AI © 2026 · Uso interno · Roteiro de contato comercial Stays*
