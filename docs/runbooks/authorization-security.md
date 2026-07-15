# Autorização de rotas mutáveis e administrativas

**Owner:** Backend/Security  
**Status:** controle estático ativo no CI  
**Última validação:** 2026-07-15  
**Próxima revisão:** após inclusão ou mudança de qualquer controller

## Objetivo

Impedir que uma nova rota de escrita ou administração seja publicada sem uma decisão explícita de autenticação, RBAC, rate limit e ownership. O gate é executado sem banco, credenciais ou chamadas externas.

## Contrato aplicado

- toda rota `POST`, `PUT`, `PATCH` ou `DELETE` precisa de `JwtAuthGuard`, autenticação de máquina aprovada ou entrada pública exata na allowlist;
- toda rota administrativa, inclusive leitura, precisa de `JwtAuthGuard`, `RolesGuard` e `@Roles('admin' | 'support')`;
- toda mutação autenticada que recebe recurso ou payload precisa vincular a operação a `req.user`, salvo cálculo autenticado sem recurso persistido explicitamente registrado;
- autenticação de máquina é restrita ao `EventsIngestApiKeyGuard` e exige `@Throttle` local;
- `ThrottlerGuard` continua obrigatório como `APP_GUARD` global;
- mutações públicas precisam de `@Throttle` local, exceto o webhook Stripe, que precisa validar assinatura de forma fail-closed;
- as allowlists usam método e caminho completos. Prefixos, curingas e correspondência parcial não são aceitos.

## Allowlist pública revisada

| Método e rota | Motivo/controle compensatório |
|---|---|
| `POST /auth/register` | bootstrap de conta, throttle estrito |
| `POST /auth/waitlist/accept` | token de convite de uso único, throttle estrito |
| `POST /auth/login` | troca de credenciais, throttle estrito |
| `POST /auth/google` | validação de token Google, throttle estrito |
| `POST /auth/refresh` | rotação de refresh cookie, throttle estrito |
| `POST /auth/logout` | revogação de refresh cookie, throttle explícito |
| `POST /contact-submissions` | formulário público, throttle estrito |
| `POST /email/verificar-usuario-state` | consulta pré-autenticação, throttle estrito |
| `POST /email/enviar-codigo` | envio de código, throttle estrito |
| `POST /email/confirmar-email` | troca de código, throttle estrito |
| `POST /email/forgot-password` | início de reset, throttle estrito |
| `POST /email/update-password` | token de reset obrigatório, throttle estrito |
| `POST /payments/webhook` | assinatura Stripe e secret obrigatórios; falha fechada |
| `POST /waitlist` | inscrição pública, throttle estrito |

Uma rota removida deixa uma entrada obsoleta e também quebra o gate. Uma rota pública nova quebra o gate até revisão explícita deste contrato.

## Ownership e IDOR

O gate exige que mutações autenticadas de recursos propaguem a identidade do JWT ao serviço. A revisão desta rodada confirmou ainda:

- notificações com ID comparam `notification.user.id` ao usuário autenticado;
- identidade, preço, ocupação e remoção de propriedades filtram por recurso e `userId`;
- regras de preço, cópia entre propriedades e ações em lote usam somente endereços retornados por `getOwnedAddress(es)`;
- simulação de evento recebe o usuário autenticado antes de calcular impacto da propriedade.

Isso reduz regressões IDOR claras, mas não substitui teste dinâmico com dois usuários reais. O gate estático não prova políticas dentro de SQL montado dinamicamente nem autorização de integrações externas.

## Execução

```bash
cd urban-ai-backend-main
npm run audit:authorization:self-test
npm run audit:authorization
npm run build
```

Para revisar o inventário completo:

```bash
node scripts/authorization-controls-audit.js --inventory
```

## Teste dinâmico ainda necessário

Em staging, criar dois hosts isolados e um admin. Para cada mutação com `:id`, tentar acessar o recurso do outro host e exigir `403` ou `404`, sem alteração no banco. Repetir com token ausente, expirado e role insuficiente; validar também limites `429` nas rotas públicas sem bloquear o webhook legítimo do Stripe.
