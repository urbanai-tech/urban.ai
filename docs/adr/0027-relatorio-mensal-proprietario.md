# ADR 0027 — Relatório mensal para o proprietário: base legal, papéis, link seguro, envio e retenção

**Status:** Aceito (31/10/2026) quanto à arquitetura. **Itens jurídicos em aberto**, listados na seção "Lote do dono": o texto de consentimento do anfitrião e o aviso ao proprietário **precisam de revisão do advogado** antes de o envio por e-mail ser ligado em produção. Decide: dono do produto (decisão 3 de 31/10: "o My Urban envia direto ao proprietário, com consentimento registrado e descadastro"). Implementa a fase 1 da proposta de frentes de produto (31/10/2026). A fase 2 (multi-conta, organização, papéis, marca própria) **fica fora**.
Relacionado: [ADR 0024](./0024-retencao-de-dados-pessoais.md) (retenção), [ADR 0017](./0017-locks-distribuidos-para-jobs-agendados.md) (jobs com lock), [ADR 0013](./0013-calendario-sao-paulo-para-todo-dia.md) (calendário de SP).

## Contexto

Administradoras e co-hosts precisam prestar contas ao dono do imóvel. Hoje tudo no My Urban é por usuário logado: o resumo semanal e o `/my-roi` falam com o anfitrião. A decisão do dono é que o My Urban **envie o relatório mensal direto ao proprietário**, sem o proprietário ter conta.

Isso introduz um **terceiro** (o proprietário) cujo nome e e-mail entram no sistema por indicação do anfitrião, e um relatório com **dado financeiro** (receita, diária, ocupação). Há quatro riscos a tratar: base legal do tratamento, quem responde pelo quê, o link público ser um bearer token e o relatório mostrar número que o anfitrião nunca registrou.

## Decisão

### 1. Modelo (sem multi-conta)

Quatro tabelas novas, uma migration reversível (`1793720000000-CreateOwnerReports`), mais a coluna `user_communication_preferences.owner_reports` (padrão ligado):

| Tabela | Papel |
|---|---|
| `property_owners` | proprietário do anfitrião: nome, e-mail (minúsculo, único por anfitrião), preferência de envio mensal, **declaração de base legal** (`consent_version`, `consent_accepted_at`, `consent_ip` = `req.ip`), `unsubscribed_at` (descadastro do próprio proprietário) e `unsubscribe_ref` (referência opaca do token de descadastro). FK para `user` com `ON DELETE CASCADE`. |
| `property_owner_properties` | vínculo proprietário → imóvel (`addresses`). Único por imóvel: um imóvel tem um proprietário; um proprietário pode ter vários imóveis. |
| `owner_reports` | snapshot do relatório de um mês (`payload_json` sem IDs internos) **e o ledger do envio** (`email_status`, `email_attempts`, `email_sent_at`). Único por (proprietário, mês). |
| `owner_report_links` | links públicos: só o hash do token, expiração, revogação e contagem de aberturas. |

**Autorização:** o anfitrião só vê, edita, remove, pré-visualiza, envia e revoga o que é dele. Toda leitura/escrita passa por `findOwned(hostUserId, ownerId)` e por `resolveOwnedAddresses` (imóvel do anfitrião ou de um anúncio dele). Recurso de outro anfitrião responde **404**, nunca 403 (não confirma que existe). Na geração do relatório os imóveis são conferidos de novo contra o dono do proprietário. As rotas do anfitrião são `@RequiresSubscription()` (mesma política de `/portfolio` e `/my-roi`; trocar para livre é uma linha, mas é decisão de paywall, que não foi tomada aqui).

### 2. Papéis e base legal (hipótese de trabalho, a validar)

- **Anfitrião/administradora = controlador** do dado do proprietário. É ele quem tem a relação com o proprietário (contrato de administração, mandato) e quem decide compartilhar o desempenho do imóvel. A prestação de contas ao dono é inerente a essa relação. Bases prováveis (LGPD art. 7º): execução de contrato (V) entre anfitrião e proprietário e/ou legítimo interesse (IX), a confirmar pelo advogado. **O My Urban não coleta consentimento do proprietário**: coleta a **declaração do anfitrião** de que tem base legal, registrada com versão do texto, data e IP.
- **My Urban = operador** no envio (monta o relatório, guarda o snapshot, entrega por e-mail e link, atende o descadastro), agindo em nome do anfitrião. O My Urban também é controlador do que é dele: o log de envio e a segurança do serviço.
- Há uma leitura alternativa (My Urban como controlador conjunto ou controlador do envio). O texto da declaração e o aviso ao proprietário foram escritos para a hipótese acima; se o advogado optar pela outra, mudam os textos e a política de privacidade, não a arquitetura.
- **Minimização:** o relatório mostra imóvel (título, bairro e cidade), receita/diária/ocupação do mês, eventos, recomendações aplicadas e efeito. **Não** carrega dado de hóspede, endereço completo, ID interno, e-mail ou telefone do anfitrião. O nome do anfitrião aparece como "preparado por".
- **Direitos do proprietário:** descadastro em um clique em todo e-mail (seção 5). Acesso, correção e eliminação são atendidos **pelo anfitrião** (editar/remover na tela) e, se o proprietário escrever ao My Urban, pelo canal de privacidade existente ([`lgpd-data-subject-requests.md`](../runbooks/lgpd-data-subject-requests.md)). Remover o proprietário apaga cadastro, relatórios e links (CASCADE).
- **Declaração do anfitrião (versão `owner-share-2026-10-v1`)** está em `owner-report.constants.ts`; mudou o texto, muda a versão. Trocar o e-mail do proprietário exige **nova declaração** (é outro destinatário) e zera o descadastro e a referência.

### 3. Relatório: nunca fabricar número

Regra do produto, a mesma do resumo semanal (`weekly-host-report.ts`, reaproveitado: `hasRecordedOutcome`, `isOutcomePending`):

- Receita, diária média e ocupação só existem se **registradas** pelo anfitrião ou **sincronizadas** (Stays / calendário manual). Sem dado, o campo é `null` e a tela escreve "Sem dado". Nunca zero, estimativa ou projeção.
- **Ficam fora do relatório** as projeções do `roi.service` (`projectedIncremental`, `potentialLost`): são estimativas. Entra só o equivalente ao `confirmedIncremental` (reserva ou receita registrada, preço aplicado acima do de partida × noites), chamado "efeito confirmado".
- **Ocupação** só com calendário real: origens `manual` e `stays_sync` (nunca `inferred` nem `airbnb_calendar`) e **pelo menos 80%** dos dias do mês com status conhecido; abaixo disso a nota explica ("calendário incompleto: 15 de 30 dias"). Bloqueados saem do denominador.
- **Resultados registrados contam no mês da data do evento**, não no mês do registro. Re-análises do mesmo evento contam uma vez (vale o último registro), para não duplicar receita.
- **Receita:** calendário primeiro (soma das noites reservadas com valor), senão resultados registrados; a fonte aparece no relatório. Diária média só com pares receita+noites.
- **Comparação com o mês anterior** só quando o **mesmo imóvel** tem dado nos dois meses; no portfólio, só os imóveis comparáveis entram (e o texto diz quantos).
- Mês em andamento é marcado "parcial". Aplicações com evento passado e sem resultado aparecem como "resultado ainda não registrado".
- **Lembrete** ao anfitrião 2 dias antes do fim do mês, só se houver aplicação do mês aguardando resultado, para ele registrar antes do relatório (respeita a preferência `ownerReports`).

### 4. Link seguro

- Token `<aleatório 256 bits>.<HMAC-SHA256 truncado em 128 bits>`. O aleatório vem de `crypto.randomBytes`; **não contém ID, e-mail ou dado**. A assinatura (segredo `OWNER_REPORT_TOKEN_SECRET`, ou `JWT_SECRET` com prefixo próprio) descarta token adulterado **sem consultar o banco** e impede forjar token só com acesso de leitura ao banco. Comparação em tempo constante; o tipo (`link`/`unsub`) entra na assinatura, então um não vale como o outro.
- **O banco guarda só o SHA-256** do aleatório. O token existe uma vez, na resposta que o entrega (botão "Copiar link" ou e-mail). Para copiar de novo, emite-se outro.
- **Somente leitura** (um único `GET`), **expira em 30 dias** (`OWNER_REPORT_LINK_TTL_DAYS`; o anfitrião pode pedir de 1 a 90), **revogável** por link ou todos de uma vez; revogação vence expiração e nunca volta.
- Resposta pública: o snapshot do relatório e metadados mínimos (período, atualização, validade, aviso). Sem IDs internos. Link inválido ou adulterado → **404** genérico; link conhecido mas vencido/revogado → **410** (`LINK_EXPIRED`/`LINK_REVOKED`), sem dados.
- `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`; a página tem `noindex` (meta e middleware) e a rota está no `robots.txt`; busca sem cookie (`credentials: omit`) e sem chamada de sessão. **Rate limit** de 30 requisições/min por IP na rota pública (20/min no descadastro).
- **Impressão/PDF:** folha de estilo de impressão (`@media print`, esquema claro forçado, botão e logo escuro ocultos) + "Imprimir ou salvar em PDF" do navegador. Sem biblioteca de PDF.
- **Limites assumidos:** quem recebe o link o lê (é um bearer token; não autentica a pessoa). Mitigações: validade curta, revogação, ausência de dado de hóspede e de contato. Um e-mail encaminhado leva o link junto.

### 5. Envio mensal, descadastro e preferências

- Job `owner-report-monthly` (`@Cron` diário às 09:00 `America/Sao_Paulo`, lock Redis + `AdminJobRun`, ADR 0017). Faz, cada fase isolada das outras: retenção; envio do **mês anterior** nos primeiros dias úteis (padrão 3, `OWNER_REPORT_SEND_WINDOW_BUSINESS_DAYS`; o 1º dia útil envia tudo, os seguintes só reenviam o que falhou); lembrete de fim de mês (uma vez por janela, `runOncePerWindow`). Dia útil = não é fim de semana nem está em `OWNER_REPORT_SKIP_DATES` (feriados **não** são calculados).
- **Idempotência por janela:** o ledger `UNIQUE(owner_id, period)` em `owner_reports`; o envio só começa se o `UPDATE` condicional `pending|failed → sending` afetar 1 linha. Dois processos, retentativa ou reinício nunca mandam o mesmo mês duas vezes; `sending` preso há mais de 30 min volta a ser tentável; 3 falhas automáticas e desiste (o botão "Enviar por e-mail" do anfitrião ignora o teto, mas não o ledger). Falha de envio grava motivo curto **sem e-mail** e revoga o link que ninguém recebeu.
- **Quem recebe:** proprietário com envio ligado, **não descadastrado**, com imóvel vinculado, cujo anfitrião está ativo, tem direito de uso (`EntitlementService`) e **não desligou** `ownerReports` em `communication-preferences` (nova preferência, em `/settings/communications`).
- **Flags (padrão seguro):** `OWNER_REPORT_ENABLED` (padrão ligado: cadastro, link, página), `OWNER_REPORT_EMAIL_ENABLED` (**padrão desligado**: só `true` envia e-mail a terceiros), `OWNER_REPORT_REMINDER_ENABLED` (padrão ligado). Sem segredo de assinatura ou sem `API_URL`, **não envia** (sem descadastro não há e-mail) e degrada com aviso, sem derrubar o boot.
- **Descadastro do proprietário:** token próprio (`unsub`), com referência opaca guardada no proprietário (não é o ID). O e-mail leva link e `List-Unsubscribe`/`List-Unsubscribe-Post` (RFC 8058). `GET` só confirma; `POST` descadastra (idempotente). O anfitrião **não** desfaz um descadastro; só trocar o e-mail (novo destinatário, nova declaração) o zera.
- O e-mail reaproveita `email/templates.ts` e o logo novo. Registro do envio: `owner_reports` e `communication_events` (via `MailerService`).

### 6. Retenção (proposta, a validar junto com o ADR 0024)

| Dado | Retenção |
|---|---|
| `property_owners` (nome, e-mail, vínculos, declaração com versão, data e IP) | Enquanto o anfitrião mantiver o cadastro; some com a conta do anfitrião (CASCADE) ou quando ele remove. A declaração é a prova do consentimento: fica enquanto o proprietário existir. |
| `owner_reports` (snapshot e ledger do envio) | `OWNER_REPORT_RETENTION_MONTHS` (padrão **12**) depois do fim do mês reportado; os links caem junto (CASCADE). Purga no job diário. |
| `owner_report_links` | Vencido ou revogado há **30 dias** é apagado. |
| `communication_events` com o e-mail do proprietário | Segue a política geral do log de comunicações (ainda sem prazo; **lacuna do ADR 0024**, agravada por ser dado de terceiro). |
| Logs da aplicação | Sem e-mail nem token: motivos de falha são mascarados. |

Os números são uma proposta; qualquer prazo sem validação jurídica pode ser contestado (mesma ressalva do ADR 0024).

## Opções consideradas

- **Só link, o anfitrião repassa** (sem envio): descartada pelo dono. Fica disponível mesmo com o e-mail desligado ("Copiar link").
- **Multi-conta com papel "leitura para proprietário"**: é a fase 2 (15–20 dias, autorização por organização em todo o backend). Fora do escopo.
- **PDF no servidor** (headless/biblioteca): descartado; impressão por CSS cobre o caso sem dependência pesada.
- **Token JWT puro:** descartado; a revogação exige estado no banco de qualquer forma e o token carregaria claims.
- **Relatório "ao vivo" em vez de snapshot:** descartado; o proprietário veria números mudando depois do e-mail e a comparação mensal ficaria irreproduzível. O snapshot é atualizado quando o **anfitrião** pede link/prévia (por isso a página mostra "Atualizado em"); o envio automático nunca reescreve um mês já enviado.

## Lote do dono (pendências que não são de código)

1. **Revisão do advogado: texto de consentimento (declaração do anfitrião) e aviso ao proprietário.** Textos em `owner-report.constants.ts` (`OWNER_CONSENT_TEXT`, `OWNER_NOTICE_TEXT`), reaproveitados no e-mail e no rodapé da página. **Não ligar `OWNER_REPORT_EMAIL_ENABLED` em produção antes disso.**
2. Confirmar a **qualificação dos papéis** (anfitrião controlador / My Urban operador) e a base legal por caso (contrato de administração, legítimo interesse).
3. Incluir na **política de privacidade e nos termos** a seção sobre dado de proprietários (quem é o controlador, finalidade, retenção, como se descadastrar) e avaliar cláusula/DPA para administradoras de maior porte.
4. Validar os **prazos de retenção** da seção 6 (e fechar o prazo do log de comunicações no ADR 0024).
5. Definir `OWNER_REPORT_SKIP_DATES` (feriados nacionais do ano) e **ligar** `OWNER_REPORT_EMAIL_ENABLED` quando 1 a 3 estiverem resolvidos.
6. Decidir se a funcionalidade fica no plano atual ou no plano Escala (hoje está sob `@RequiresSubscription()`, como portfólio e ROI).

## Consequências

- (+) O My Urban passa a prestar contas ao dono do imóvel sem criar conta, com consentimento do anfitrião registrado, descadastro e retenção definidos; e o relatório mantém a promessa de só mostrar o que foi registrado.
- (+) Fase 2 (multi-conta) reaproveita as tabelas: `property_owners` vira a ponta "leitura" de uma organização.
- (−) Com poucos resultados registrados o relatório mostra mais "sem dado" do que número; o lembrete de fim de mês e o botão de resultado existem por isso. Métrica de sucesso: ≥ 30% dos anfitriões com 3+ imóveis gerando ao menos um relatório no primeiro mês e abertura do link ≥ 50% (`view_count` por link).
- (−) Dado de terceiro com receita passa a existir no banco; o risco é mitigado por minimização, retenção e CASCADE, mas depende da revisão jurídica.
- (−) Feriados não são calculados; sem `OWNER_REPORT_SKIP_DATES` o "1º dia útil" pode cair num feriado (o envio ainda acontece na janela de 3 dias úteis).
- (−) Sem proteção contra encaminhamento do link: é um bearer token.
