# Performance e budget de JavaScript

## Gate automatizado

O build de produção executa `bundle:check` depois do `next build`. O gate mede os
arquivos JavaScript de `rootMainFiles` no manifesto do Next.js, comprime cada
chunk com gzip nível 9 e falha se o total compartilhado ultrapassar **180 KiB**.

- `npm run bundle:report`: mostra o shared JS e as rotas críticas monitoradas.
- `npm run bundle:check`: aplica o limite e retorna código de erro quando excedido.
- `npm run bundle:test`: valida deduplicação de chunks e o limite sem depender de build.

A medição usa bytes reais dos artefatos `.next`, não o texto arredondado do log do
Next.js. Isso torna o resultado reproduzível localmente e no CI.

## Observabilidade: decisão e trade-off

O Sentry continua inicializado no cliente e mantém:

- captura de exceções e erros não tratados;
- rastreamento de navegação pelo App Router;
- performance tracing com amostragem de 10% em produção e 100% em staging;
- source maps quando `SENTRY_AUTH_TOKEN` está disponível.

Session Replay foi removido do runtime cliente. Ele adicionava código ao bundle
compartilhado e gravava apenas 1% das sessões normais, enquanto error tracking e
tracing já cobrem os sinais operacionais essenciais. O custo assumido é não haver
reprodução visual da sessão que antecedeu um erro. Se Replay voltar a ser requisito,
ele deve ser habilitado junto com um budget específico e validação de consentimento.

As otimizações de build do SDK também excluem código de debug e implementações de
Replay para Shadow DOM, iframe e worker. Nenhuma delas desabilita captura de erro
ou tracing.

Para não bloquear a primeira renderização, o SDK é carregado em ociosidade após o
evento `load` (com timeout de 2 segundos). Durante essa janela curta, listeners
nativos armazenam erros e promises rejeitadas em memória; a fila é enviada assim
que o Sentry inicia. Uma navegação que comece antes disso força a inicialização e
preserva o tracing do App Router. O trade-off é que contexto avançado coletado pelo
SDK pode ser mais limitado apenas para erros ocorridos antes da sua inicialização.

## Animações

Home e cadastro usam uma animação CSS de entrada, respeitando
`prefers-reduced-motion`. `framer-motion` permanece somente onde há transições de
estado complexas, como onboarding, evitando uma migração de risco sem ganho claro.
