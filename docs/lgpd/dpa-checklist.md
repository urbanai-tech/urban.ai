# Checklist — Assinatura de DPAs com subprocessadores

**Prazo:** fechar os 6 primeiros até **semana 7 (13/05/2026)**, antes do beta fechado.

Cada DPA garante que o operador trata os dados com as mesmas proteções que a Urban AI oferece aos titulares. Sem DPA assinado, a base legal de compartilhamento fica frágil em caso de incidente.

---

## Procedimento geral

1. Acessar o link do DPA padrão do operador.
2. Revisar os pontos críticos (seção abaixo de cada um).
3. Aceitar online OU baixar, preencher, assinar (digitalmente) e devolver pelo canal indicado.
4. Salvar PDF em `docs/lgpd/dpa/<operador>.pdf` no repo.
5. Atualizar a tabela em `docs/lgpd/politica-privacidade-interna.md` §5 com status ✅.

---

## 1. Stripe

- **Link:** https://stripe.com/legal/dpa
- **Como fazer:** no Dashboard → Settings → Security → Data processing addendum → aceitar online.
- **Pontos críticos:**
  - Lista de subprocessadores que o Stripe usa (AWS, terceiros anti-fraude) — vem já no DPA.
  - Transferência internacional (Stripe processa parte do fluxo nos EUA) — cláusula está incluída.
  - Notificação de incidentes em ≤ 24h — ok no template.
- **Após aceitar:** salvar o PDF que o Stripe disponibiliza para download.

## 2. Mailersend

- **Link:** https://www.mailersend.com/legal/dpa
- **Como fazer:** abrir ticket no suporte pedindo DPA assinado. Eles enviam um DocuSign.
- **Pontos críticos:**
  - Dados mínimos compartilhados (só e-mail + nome + corpo do e-mail) — ok.
  - Retenção no MailerSend: 30 dias de histórico de envios.
- **Após assinar:** download via DocuSign, salvar no repo.

## 3. AWS

- **Link:** https://aws.amazon.com/service-terms/
- **Como fazer:** o DPA da AWS está incluído nos Service Terms automaticamente — basta aceitar ao criar a conta/usar S3. Para formalizar: Console → Artifact → Reports → **AWS GDPR DPA** (inclui addendum LGPD).
- **Pontos críticos:**
  - Região sa-east-1 usada para o bucket `urbanai-data-lake` — documentar.
  - IAM user `urban-ai-scrapy` com permissão restrita — já configurado.
- **Após baixar:** salvar no repo.

## 4. Railway

- **Link:** https://railway.app/legal/dpa
- **Como fazer:** enviar e-mail para `legal@railway.com` pedindo DPA assinado. Railway mantém um template padrão pronto.
- **Pontos críticos:**
  - Confirmar onde os dados vivem (us-east por padrão) — considerar solicitar sa-east se disponível em plano superior.
  - SLA de disponibilidade — não vem no DPA, vem em separado.

## 5. Upstash Redis

- **Link:** https://upstash.com/trust/dpa
- **Como fazer:** aceitar online na console.
- **Pontos críticos:**
  - Dados em Redis são **voláteis** (filas, cache, refresh token hash) — baixo risco.
  - Nenhum dado persistente sensível deve ir para Redis.

## 6. Sentry

- **Link:** https://sentry.io/legal/dpa
- **Como fazer:** aceitar online em Settings → Legal & Compliance.
- **Pontos críticos:**
  - Scrubbing automático de PII no frontend (já configurado via `beforeSend` — revisar).
  - Retenção de eventos (30–90 dias dependendo do plano).

## 7. Google Cloud (Maps API, OAuth)

- **Link:** https://cloud.google.com/terms/data-processing-addendum
- **Como fazer:** console Google Cloud → IAM → Data Processing Addendum → aceitar.
- **Pontos críticos:**
  - OAuth consent screen precisa listar escopos mínimos (já fazemos só `email`, `profile`).
  - Maps API processa endereços — documentar na política.

## 8. Stays (quando fechar parceria, F6.4)

- **Link:** negociação bilateral, não padrão.
- **Como fazer:** incluir como anexo do contrato comercial.
- **Pontos críticos:**
  - Fluxo bidirecional — Stays repassa dados de reservas para Urban AI e Urban AI empurra preços de volta.
  - Limitação de uso: dados de clientes Stays não podem ser usados para treinar modelo "público" da Urban AI sem consentimento explícito do titular.
  - Retenção: enquanto a conta Urban AI estiver ativa + 90 dias após cancelamento.
- **Após assinar:** salvar + atualizar `docs/lgpd/politica-privacidade-interna.md` §4.

---

## Template de resposta a titular (LGPD Art. 18)

Colocar em `docs/lgpd/template-resposta-lgpd.md` quando a primeira solicitação chegar. Rascunho:

```
Prezado(a) <Nome>,

Recebemos sua solicitação de <acesso/correção/anonimização/exclusão/portabilidade/revogação>
relativa aos dados pessoais tratados pela Urban AI em <data>.

Sua solicitação foi registrada sob o protocolo <YYYY-MM-DD-NNN>. Prazo legal
para resposta: 15 dias corridos (LGPD art. 19).

<bloco específico conforme o tipo de solicitação>

Para dúvidas adicionais ou acompanhamento, responda este e-mail.

Atenciosamente,
Gustavo Macedo — Encarregado de Dados (DPO)
privacidade@myurbanai.com
Urban AI
```

---

*Última atualização: 24/04/2026 · Responsável: Gustavo Macedo*
