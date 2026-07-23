# Site público comercial — redesign de lançamento

Data: 2026-07-21  
Branch: `codex/public-site-conversion-redesign`  
Escopo: landing page, páginas públicas, cadastro e configuração pública de lançamento.

## Resultado

O site público deixou de operar como manifesto de pré-lançamento e passou a apresentar a Urban AI como produto comercial disponível. A nova experiência preserva o contraste preto/laranja e a personalidade editorial da marca, mas organiza a decisão do visitante em uma sequência de conversão: proposta, prova de produto, funcionamento, controle, planos, confiança e cadastro.

O funil canônico agora é:

```text
Página pública → entender o produto → comparar plano → criar conta → onboarding → painel
```

Não existe mais desvio visual de `/create` para lista de espera. O backend adota `public` como modo padrão quando não há configuração explícita legada.

## Arquitetura da experiência pública

| Camada | Responsabilidade | Implementação |
|---|---|---|
| Layout público | Cabeçalho, navegação, rodapé, estrutura global | `HeaderPublic`, `FooterPublic`, layout `(public)` |
| Sistema de marketing | CTAs, demonstração do produto, grids, confiança, listas e fechamento comercial | `PublicMarketing.tsx` |
| Tema e responsividade | Tokens, primeira dobra, componentes, breakpoints e mobile | `globals.css` |
| Conteúdo comercial | Landing, preços, início, sobre e contato | rotas dedicadas em `(public)` |
| Conteúdo orgânico | Guias, comparação, integração e segurança | `seoContent.tsx` + `seoPagesData.ts` |
| Conversão | Cadastro, autenticação e evento `sign_up` | `/create` + `Analytics.tsx` |
| Modo de lançamento | Configuração pública e gate de registro | `usePrelaunch.ts` + `AppController` |
| Descoberta | metadata, Open Graph, sitemap e JSON-LD | `layout.tsx`, `sitemap.ts`, helpers de SEO |

## Mapa de rotas e intenção

| Rota | Papel na jornada | Mudança principal |
|---|---|---|
| `/` / `/landing` | Aquisição e explicação | Hero compacto, demonstração realista, pilares, processo, segmentos, preços e FAQ |
| `/precos` | Decisão comercial | CTA por plano, preço visível cedo, comparação de recursos e ciclos claros |
| `/lancamento` | Entrada comercial preservando URL histórica | Lista de espera removida; página “Comece agora” com cadastro direto |
| `/sobre` | Confiança institucional | Razão de existir, princípios, construção do produto e origem em São Paulo |
| `/contato` | Conversa comercial e suporte | Formulário acima da dobra útil, assunto estruturado e canais por finalidade |
| Guias de precificação | Descoberta orgânica e educação | Sumário, resposta direta, pontos-chave, método prático, FAQ e CTA |
| `/urban-ai-vs-planilha-de-precificacao` | Consideração | Tabela de comparação explícita, sem promessa absoluta |
| `/integracao-stays-precificacao-automatica` | Avaliação técnica | Controle, consentimento, limites e rastreabilidade |
| `/seguranca-lgpd-ia-precificacao` | Confiança e governança | Critérios verificáveis, controle humano e canais de privacidade |
| `/termos` e `/privacidade` | Segurança jurídica | Layout legível, datas atualizadas e linguagem coerente com produto disponível |
| `/create` | Conversão | Formulário real, envio por Enter, telemetria de cadastro e ausência de waitlist |

## Design system público

### Direção

- Base: `#080A0F`, superfícies discretas e divisores de baixo contraste.
- Destaque: laranja Urban AI para ação, sinal e estado — não como decoração indiscriminada.
- Tipografia: Bebas Neue em títulos editoriais; Inter em leitura e controles.
- Geometria: cantos retos, grades, bordas finas e densidade de produto profissional.
- Ícones: Lucide, com função semântica e peso visual consistente.
- Movimento: transições curtas e removidas quando `prefers-reduced-motion` está ativo.

### Componentes reutilizáveis

- `PublicButton`: CTA primário, secundário e textual.
- `ProductPreview`: demonstração codificada do fluxo preço atual → recomendado → motivo → aplicação.
- `SectionHeading`: hierarquia editorial uniforme.
- `PillarGrid`: capacidades centrais do produto.
- `TrustBar`: controle humano, explicabilidade, automação opcional e público-alvo.
- `CheckList`: recursos e garantias operacionais.
- `FinalCommercialCta`: fechamento único de conversão.

## Jornada principal

1. Visitante entende em poucos segundos que a Urban AI é uma ferramenta de precificação para aluguel por temporada.
2. A primeira tela mostra simultaneamente proposta, CTA e uma simulação fiel do produto.
3. O visitante entende quais sinais entram na recomendação e que mantém o controle.
4. Ele escolhe entre aprender mais, comparar planos ou criar a conta.
5. O cadastro cria um usuário real, autentica e segue para o pós-login/onboarding.
6. O evento de conversão `sign_up` respeita o consentimento de analytics e marketing.

## Problemas resolvidos

- Removidas referências públicas a beta, convite, acesso antecipado e fila.
- Eliminado o conflito entre CTA de cadastro e waitlist em `/create`.
- Removidas métricas promocionais sem evidência auditável da landing.
- Adicionada prova visual do produto sem fabricar depoimentos, logos ou cases.
- Reduzida a altura da primeira dobra: no desktop, CTA e demonstração aparecem juntos.
- Preços e cards começam a aparecer na primeira tela da página de planos.
- Navegação mobile ganhou alvo 44×44, `aria-expanded`, `aria-controls`, Escape, foco devolvido e bloqueio de scroll.
- Corrigido overflow horizontal mobile detectado durante QA visual.
- Página comparativa ganhou tabela real.
- Conteúdo orgânico deixou de renderizar placeholders de “evidências em validação”.
- Contato passou a classificar o assunto antes do envio.
- Cadastro passou a usar formulário semântico e submissão por teclado.
- Open Graph passou a representar a nova landing, não apenas o ícone do app.

## Scorecard de liberação

| Dimensão | Meta | Evidência | Estado |
|---|---:|---|---|
| Proposta de valor | 10/10 | Hero específico, público e benefício claros | Aprovado em código |
| Prova de produto | 10/10 | Demonstração com evento, preço, motivo e controle | Aprovado em código |
| Conversão | 10/10 | CTA canônico, cadastro real e telemetria | Aprovado em testes |
| Preços | 10/10 | CTA por plano, ciclos, comparação e sem comissão | Aprovado em código |
| Mobile | 10/10 | Sem overflow, CTA na primeira tela, menu 44×44 | Aprovado em browser/E2E |
| Acessibilidade | 10/10 | Menu semântico, Escape, foco, formulários e reduced motion | Aprovado no escopo alterado |
| Conteúdo/SEO | 10/10 | Sumário, respostas diretas, tabela, FAQ e JSON-LD | Aprovado em build |
| Confiança | 10/10 | Controle, LGPD, limites e ausência de promessas fabricadas | Aprovado em conteúdo |
| Performance | 10/10 | Build e orçamento de bundle aprovados | Aprovado |
| Operação real | 10/10 | `LAUNCH_MODE=public` em produção e smoke pós-deploy | Pendente de promoção operacional |

O scorecard só chega a 10/10 operacional depois que o ambiente de produção estiver explicitamente em `LAUNCH_MODE=public`, o deploy desta branch estiver promovido e o cadastro real for validado no domínio final sem criar conta de teste não autorizada.

## Validação executada

- `npm run typecheck`: aprovado.
- `npm run build`: 76 páginas geradas e bundle budget aprovado.
- Lint dos arquivos alterados: aprovado, zero alertas.
- Contrato do site público: 6/6 testes aprovados.
- Backend: 32/32 testes de configuração e cadastro aprovados.
- E2E do redesign público: 4/4 aprovados.
- E2E de cadastro comercial e analytics: aprovado.
- Release smoke público no servidor de desenvolvimento: jornadas funcionais aprovadas; 9/9 rotas também responderam HTTP 200 no build final com `next start`.
- Limitação do host local: o Playwright contra `next start` excedeu até 120 s em `page.goto` quando executado sobre o worktree/junction dentro do OneDrive. Não houve falha de asserção ou erro de runtime; o smoke de navegador precisa ser repetido no staging Railway antes da promoção.
- QA visual desktop: landing, preços, contato, conteúdo e cadastro revisados.
- QA visual mobile: landing e preços revisados; overflow final `scrollWidth = clientWidth`.

## Gates antes da produção

1. Repetir o smoke Playwright no staging Railway, onde não existe a contenção de I/O do worktree local.
2. Configurar `LAUNCH_MODE=public` e `PRELAUNCH_MODE=false` no backend de produção.
3. Confirmar que o frontend de produção não foi construído com `NEXT_PUBLIC_PRELAUNCH_MODE=true`.
4. Publicar frontend e backend de forma coordenada.
5. Validar `/public-config`, `/create`, cadastro, login, onboarding e página de planos no domínio real.
6. Revisar as alterações de Termos e Privacidade com responsável jurídico antes de considerar o texto jurídico definitivamente aprovado.
