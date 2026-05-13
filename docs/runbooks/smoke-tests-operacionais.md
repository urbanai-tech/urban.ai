# Smoke Tests Operacionais - Urban AI

Data: 2026-05-13

Executar estes testes apos deploy em staging e antes de promover para producao. Nao registrar API keys, senhas reais ou tokens em prints/logs.

## 1. Auth e Sessao

- Login com usuario ativo.
- Confirmar que `/auth/me` retorna usuario autenticado.
- Atualizar perfil em `/auth/profile`.
- Logout e confirmar que `/auth/me` passa a retornar 401.
- Tentar acessar endpoint admin com usuario comum e confirmar 403.
- Tentar acessar endpoint admin com admin e confirmar sucesso.

## 2. Reset de Senha

- Solicitar reset para e-mail existente.
- Confirmar recebimento do link com token, sem `userId`.
- Definir nova senha.
- Logar com nova senha.
- Reutilizar o mesmo link e confirmar falha.
- Solicitar reset para e-mail inexistente e confirmar resposta neutra, sem indicar se usuario existe.

## 3. Cadastro, Confirmacao e Onboarding

- Criar conta nova fora de prelaunch.
- Confirmar e-mail com codigo.
- Passar por `/post-login`.
- Cadastrar primeira propriedade/endereco.
- Confirmar que `/users/me/has-address` muda para verdadeiro.
- Abrir `/address-verification` e confirmar redirecionamento para `/onboarding`.
- Completar onboarding sem depender de `localStorage.registeredProperties`; a criacao de enderecos deve ser seguida por enqueue em `/processos`.

## 4. Propriedades e Ownership

- Usuario A cria propriedade/endereco.
- Usuario B tenta buscar/deletar endereco de A por ID e deve receber 404/403.
- Usuario A lista dropdown, propriedades e eventos analisados apenas dos proprios enderecos.
- Delecao de endereco por Usuario A remove somente recursos dele.
- Com quota cheia, tentar registrar novo imovel deve falhar com `LISTINGS_QUOTA_EXCEEDED` antes de criar `List` parcial.
- Reenviar o mesmo imovel/endereco nao deve criar novo `Address` nem aumentar a contagem de quota.

## 5. Pricing e Sugestoes

- Gerar/consultar sugestoes de preco para propriedade do usuario.
- Aceitar sugestao autenticado como dono.
- Tentar aceitar sugestao de outro usuario e confirmar 403.
- Registrar preco aplicado como dono.
- Confirmar que job pesado/admin de pricing nao roda com usuario comum.

## 6. Notificacoes

- Admin cria notificacao para usuario.
- Usuario lista notificacoes.
- Usuario marca propria notificacao como lida.
- Outro usuario tenta marcar a notificacao e deve receber 403.

## 7. Stripe

- Criar checkout com usuario autenticado.
- Confirmar redirecionamento para Stripe.
- Simular webhook assinado em staging.
- Confirmar assinatura/subscription local atualizada.
- Cancelar assinatura pelo produto e confirmar estado local.

## 8. Stays

- Conectar conta Stays em sandbox/manual token.
- Validar que token invalido e rejeitado.
- Confirmar no banco que `stays_accounts.accessToken` fica com prefixo `enc:v1:` em staging/producao.
- Sincronizar listings.
- Enviar push de preco em listing ativo.
- Confirmar idempotencia repetindo mesmo push.
- Fazer rollback de um `PriceUpdate` bem-sucedido.
- Desconectar conta e confirmar que sync/push passam a falhar de forma controlada.

## 9. Eventos, Mapas e Jobs

- Usuario comum nao deve disparar jobs admin de geocoding/processamento global.
- Usuario anonimo nao deve acessar `/process-status`, `/airbnb/*`, `/connect/resolve`, `/connect/user-managed-listings/:id` nem consultas Airbnb/RapidAPI em `/propriedades/*`.
- Admin pode consultar status e disparar batch controlado em staging.
- Completar onboarding com um imovel novo e confirmar que a chamada a `/processos` acontece depois de criar o endereco.
- Adicionar imovel pelo modal em `/properties` e confirmar que tambem cria endereco e enfileira analise.
- Enviar para `/processos` um `listId` de outro usuario e confirmar que nao gera job para aquele ID.
- Disparar duas vezes o mesmo job por propriedade e confirmar que a segunda solicitacao retorna/contabiliza duplicado, sem criar outro job ativo.
- Disparar duas vezes o mesmo job admin de pricing para a mesma propriedade e confirmar retorno de `job ja existente` enquanto o primeiro estiver pendente/ativo.
- Durante batch global, tentar iniciar outro `/maps/processar-analises` e confirmar que o segundo nao inicia enquanto `process_status` estiver `running`.
- Ao criar propriedade/endereco novo, confirmar que `addresses.analisado` nasce como `pending` antes do worker iniciar.
- Ao concluir job por propriedade, conferir que `addresses.analisado` fica `completed`; em falha controlada, deve ficar `error`.
- Conferir logs para erros de Google Maps/API externa.
- Validar que jobs respeitam limites de lote.

## 10. Observabilidade

- Conferir Sentry sem erro artificial publico.
- Conferir logs do backend sem senha/hash/token em payload.
- Conferir status dos webhooks Stripe.
- Conferir metricas de erro e latencia apos smoke.
