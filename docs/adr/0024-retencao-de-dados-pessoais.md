# ADR 0024 — Retenção de dados pessoais: IP/user-agent, token de convite da waitlist e dados de cobrança na exclusão

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: quem responde pela LGPD (encarregado/DPO) com Engenharia (Gustavo); a base jurídica dos prazos precisa de validação de advogado. Itens "a confirmar" de [`DICIONARIO-DE-DADOS.md`](../DICIONARIO-DE-DADOS.md).

## Contexto — o que o código faz hoje

1. **IP e user-agent** ficam em texto puro, **sem prazo de retenção**, em `refresh_tokens`, `password_reset_tokens`, `waitlist`, `contact_submissions`, `price_updates`, `stays_accounts` (prova de consentimento) e `push_subscriptions` (dicionário, seção de IP/user-agent). Alguns são truncados (80/64/255 caracteres), nenhum expira.
2. **Token de convite da waitlist** (`waitlist.inviteToken`) fica em texto puro; expira (`inviteTokenExpiresAt`) e é limpo ao usar. Já refresh e reset de senha guardam só SHA-256.
3. **Exclusão de conta** (`AuthService.deleteOwnAccount`): exige reautenticação, cancela a assinatura ativa (ou falha com 503), desconecta a Stays, revoga sessões e remove o usuário. As tabelas dependentes caem por **cascade** (por exemplo, `Payment` tem `ManyToOne(() => User, { onDelete: 'CASCADE' })`). Ou seja, registros de pagamento somem junto com a conta. Não há anonimização que preserve o que a lei fiscal ou contábil possa exigir guardar.
4. Também sem prazo: `ask_urban_messages.content` (texto livre), `contact_submissions.message`.

## Opções consideradas

**IP/user-agent**: (a) manter indefinidamente (hoje); (b) expirar por tabela via job (ex.: tokens revogados/expirados e `contact_submissions` em poucos meses; `price_updates` e consentimento da Stays por mais tempo por serem trilha de auditoria/prova); (c) anonimizar (truncar IP, descartar user-agent) após a janela.
**Convite da waitlist**: (a) manter texto puro; (b) guardar hash SHA-256 e comparar no uso (mesmo padrão de refresh/reset).
**Cobrança na exclusão**: (a) cascade total (hoje); (b) reter os registros de pagamento mínimos exigidos por obrigação legal (valor, data, identificadores do provedor), desvinculados do perfil, pelo prazo legal; apagar o restante.

## Recomendação

- **IP/user-agent**: opção (b)+(c) com um job agendado (já há infraestrutura de jobs e locks, [ADR 0017](./0017-locks-distribuidos-para-jobs-agendados.md)): prazos por finalidade, documentados em `DICIONARIO-DE-DADOS.md` e na política de privacidade. Sugestão inicial a validar: segurança de sessão e reset em dias a poucos meses; contato e waitlist enquanto durar o atendimento/convite; auditoria de preço e prova de consentimento por prazo maior, com IP truncado.
- **Convite**: opção (b). É mudança pequena (hash na emissão e na verificação, migração dos convites pendentes ou invalidá-los) e alinha com o resto do sistema.
- **Cobrança**: **não alterar o cascade antes de ouvir contabilidade e advogado** sobre o que precisa ser guardado e por quanto tempo. Se houver obrigação de guarda, implementar opção (b) com anonimização do vínculo; se não houver, documentar que o apagamento total é intencional. A decisão tem de aparecer na política de privacidade e na resposta a titulares ([`runbooks/lgpd-data-subject-requests.md`](../runbooks/lgpd-data-subject-requests.md)).

## Consequências

- (+) Define prazos por finalidade, reduz a superfície em caso de vazamento e responde às perguntas de titulares e auditorias.
- (−) Exige jobs de expiração e migrações; truncar IP reduz o valor forense.
- (−) Qualquer prazo escolhido sem validação jurídica pode ser contestado; este ADR propõe a estrutura, não os números finais.
