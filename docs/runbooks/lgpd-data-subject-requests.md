# Controles LGPD e solicitações de titulares

**Owner operacional:** Produto + Engenharia  
**Status:** controles técnicos parciais; validação jurídica e operação real pendentes  
**Última auditoria sem credenciais:** 2026-07-15

## Limites desta auditoria

O gate local lê código, decorators, migrations, testes e documentação. Ele não executa exclusão, exportação ou anonimização, não conecta ao banco e não acessa provedores. Também não define base legal ou prazo de retenção: essas decisões exigem aprovação da controladora e revisão jurídica.

## Matriz comprovável

| Direito/controle | Estado técnico comprovado | Limite atual |
|---|---|---|
| Acesso ao próprio usuário | `GET /auth/me`, `/auth/profile/` e `/auth/user/:id` autenticados; leitura cruzada é recusada salvo admin | Exportação consolidada não implementada; esses endpoints não cobrem todos os dados relacionados |
| Correção | `PUT /auth/profile` autenticado | Não substitui processo para correção em provedores externos |
| Exclusão self-service | `DELETE /auth/me` usa exclusivamente `req.user.userId`; `AuthService.deleteUser` remove o usuário encontrado | Requer drill em banco temporário para provar todas as cascatas e inventariar registros `SET NULL`/externos |
| Exclusão administrativa | `DELETE /auth/:id` exige JWT, `RolesGuard` e role `admin` | Uso deve estar vinculado a ticket e autorização do titular/controladora |
| Portabilidade/exportação | Não há endpoint consolidado | Exportação consolidada não implementada; atendimento deve ser manual, revisado e sem SQL ad hoc destrutivo |
| Anonimização | Relações auditáveis específicas usam `SET NULL`; isso apenas rompe a FK com o usuário | Anonimização automatizada não implementada e `SET NULL` não prova remoção de PII no payload |
| Retenção | Backup/restore e alguns prazos operacionais estão documentados | Para dados de aplicação não existe rotina automatizada de retenção nem matriz jurídica aprovada por categoria |
| Consentimento Stays | Servidor exige aceite + versão antes do `ping`; persiste data, versão, IP e user-agent; desconexão zera token | Retenção/revogação completa do histórico e texto jurídico ainda precisam de definição aprovada |
| Termos, privacidade e marketing | Pendências estão registradas na política interna | Não existe consentimento geral versionado no servidor nem opt-in de marketing certificado por este gate |

## Gate seguro

```bash
cd urban-ai-backend-main
npm run audit:lgpd:self-test
npm run audit:lgpd
npx jest --runInBand src/auth/auth.controller.spec.ts src/auth/auth.service.spec.ts src/stays/stays.service.spec.ts src/migration-tests/PaymentUserCascadeOnDelete.spec.ts
```

O auditor falha se:

- self-delete deixar de usar o principal autenticado;
- delete administrativo perder RBAC;
- leitura cruzada perder checagem owner/admin;
- consentimento Stays deixar de ocorrer antes da chamada externa;
- campos de auditoria de consentimento desaparecerem;
- uma relação TypeORM direta com `User` não declarar `CASCADE` ou `SET NULL`;
- a documentação passar a esconder as lacunas de exportação, anonimização ou retenção.

## Procedimento de solicitação

1. Registrar ticket, data, identidade, escopo, responsável e prazo.
2. Confirmar identidade por canal controlado; não pedir senha, token ou documento em chat aberto.
3. Classificar acesso, correção, exportação, exclusão, revogação ou oposição.
4. Consultar owner jurídico antes de reter ou excluir por obrigação legal/contratual.
5. Executar primeiro em staging/clone quando envolver cascata, script ou integração.
6. Para exclusão real, obter aprovação explícita e snapshot conforme runbook de backup; este gate nunca executa a operação.
7. Validar provedores externos e registros `SET NULL` individualmente; não presumir anonimização.
8. Entregar resposta em linguagem simples e guardar evidência sem expor dados no repositório.

## Pendências que bloqueiam certificação 10/10

- matriz de retenção por categoria, finalidade, base aprovada e descarte;
- exportação/portabilidade consolidada e testada;
- anonimização real com inventário de PII por tabela/payload;
- restore drill + delete drill em banco temporário com contagens antes/depois;
- consentimento geral e marketing versionados server-side;
- processo comprovado de revogação e deleção nos subprocessadores;
- validação jurídica das bases, exceções e prazos.
