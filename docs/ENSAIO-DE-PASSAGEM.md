# Ensaio de passagem — um time novo consegue assumir?

Roadmap H10. Data: 2026-10-26. Executado por um agente que se comportou como um time que acabou de receber o repositório e **só podia usar o que está nele**: sem perguntar a ninguém, sem acesso a Railway, Stripe, AWS ou qualquer provedor, sem o histórico de conversas. Quando a documentação não respondeu, isso foi registrado como achado. Ponto de partida: `urbanai-tech/main` no commit `b02bd18`. Ambiente: Windows 11, Docker Desktop 29 (VM com ~7 GB de RAM), Node 24 no host.

Complementa os [ensaios de runbooks](./runbooks/ENSAIOS.md) (H7), que testaram procedimentos operacionais; este testa a **entrada**: entender, subir, validar e entregar uma mudança.

## 1. Linha do tempo

Tempos em minutos desde o início (T+0 = leitura do `README.md`). Horários de relógio da máquina.

| Etapa | T+ | O que aconteceu |
|---|---|---|
| Ler `README.md`, `CONTRIBUTING.md`, `docs/README.md` | 0 a 1 | Ficou claro **o que o produto faz** (eventos próximos + recomendação de preço para anfitriões Airbnb, beta controlado) e **como rodar** (Compose). Textos curtos e bem encadeados. |
| `ARQUITETURA-ATUAL.md`, `docker-compose.yml`, índice de ADRs | 1 a 3 | **Fluxo de dados** entendido pelos diagramas das seções 2, 3 e 10 (coleta, outbox, `/events/ingest`, dedup, recomendação, aplicação, outcome). |
| `DICIONARIO-DE-DADOS.md`, runbooks, `ENSAIOS.md`, `validate-local.sh` | 3 a 5 | **Como validar uma mudança** entendido (`scripts/validate-local.sh`, espelha o CI). Dicionário de dados é gerado e conferido por teste: excelente. |
| `docker compose up -d mysql redis backend frontend` | 1 (início) | Imagens baixadas e containers criados em ~20 s. |
| MySQL saudável | 3 | ~2 min na primeira vez (inicialização do volume). |
| `npm ci` + 59 migrations no backend | 3 a 14 | Migrations concluídas por volta de T+14 (`Migration ... has been executed successfully` até `AddShadowV2ToAnalisePreco`). |
| Primeira compilação do `nest start --watch` | 14 a 32 | Disputou CPU com o Next (que usou ~400% de CPU compilando). |
| **Backend `/health/live` = 200** | **~32** | `{"status":"ok"}`. Contêiner `healthy`. |
| **Home do front = 200** | **~44** | Primeira requisição a `/` levou 377 s (Next compila sob demanda). |
| Derrubada (`docker compose down -v`) | 45 | 40 s. Nenhum container, volume ou rede `urban-ai` restou (conferido com `docker ps -a`, `docker volume ls`, `docker network ls`). |

Prova da subida: 59 linhas na tabela `migrations`, 46 tabelas no schema `ai_urban` (45 entidades + `migrations`), `migration:show` com 59 aplicadas e nenhuma pendente. O instruído "~10 min" para o primeiro boot no Windows **não se confirmou**: foram ~32 min até o backend e ~44 min até o front. Isso agora está no `CONTRIBUTING.md`.

Resumo dos marcos pedidos: **o que o produto faz** em 1 min; **como rodar** em 1 min (executar custou 32 a 44 min); **como validar** em 5 min; **fluxo de dados** em 3 min.

## 2. O que funcionou

- Trilha de leitura explícita ("Comece aqui") repetida no `README.md` e em `docs/README.md`, sem divergência entre elas.
- `ARQUITETURA-ATUAL.md` honesta sobre o que está inativo (fluxo S3, Vercel, `api.myurbanai.com`) e sobre pendências; diagramas Mermaid no ponto certo.
- ADRs com status (aceito / em aberto) e índice com datas; decisões abertas visíveis na seção 11 da arquitetura.
- `docker-compose.yml` com valores fictícios, `.env` opcional, migrations antes do `start:dev` e `DB_SYNCHRONIZE=false`: **subiu sem nenhuma configuração manual**.
- `scripts/validate-local.sh` imprime `nome=codigo` por etapa e resumo; existem guardas (`public-scope-guard`, `audit-document-links`) que barram arquivo fora da allowlist.
- `docs/DICIONARIO-DE-DADOS.md` gerado das entidades e verificado por teste Jest.
- Migrations a partir do zero funcionam (59 aplicadas, sem pendência), sem tocar em produção.

## 3. Fricções encontradas

Severidade: **alta** (impede ou engana quem chega), **média** (custa tempo ou induz erro), **baixa** (ruído).

| # | Severidade | Fricção | Correção |
|---|---|---|---|
| 1 | Alta | `README.md` ensinava só o setup no host (`npm ci`, `cp .env.example .env`, "preencher") enquanto o `CONTRIBUTING.md` diz que Docker é o único requisito. Dois caminhos sem dizer qual é o recomendado; o do README exige MySQL, Redis e segredos. | **Feita** (commit de docs): README aponta o Compose como recomendado e deixa o host como alternativa. |
| 2 | Alta | Tempo do primeiro boot descrito como "alguns minutos"; real: ~32 min (backend) e ~44 min (front) no Windows. Sem como saber o que está acontecendo (`health: starting` por meia hora). | **Feita**: tempos medidos, como acompanhar (`docker compose ps`, logs, o que cada linha significa) e critério de "pronto" no CONTRIBUTING. **Proposta**: `frontend` depender de `backend: service_healthy` (hoje `service_started`) para os dois compiladores não disputarem CPU; ou imagem de dev pré-construída com dependências. |
| 3 | Média | Nenhuma versão de Node fixada (sem `.nvmrc`, sem `engines`); só o CI e os containers usam 20. O host aqui tinha Node 24. | **Parcial**: `npm run doctor` avisa se a major não for 20 e o CONTRIBUTING cita o requisito. **Proposta**: `.nvmrc` e `engines` (exige incluir `.nvmrc` na allowlist da raiz). |
| 4 | Média | Conflito não documentado: `nest build` / `validate-local.sh --backend` no host escreve `urban-ai-backend-main/dist`, que o backend do Compose (bind mount) também usa. | **Feita**: aviso no CONTRIBUTING e no `doctor`. |
| 5 | Média | `validate-local.sh --backend` sempre roda `npm ci` (≈5 min no Windows) e a suíte inteira; não há como validar só o que mudou. CONTRIBUTING não diz como rodar um teste isolado. | **Proposta**: flag `--no-install` e uma linha no CONTRIBUTING com `npx jest <caminho>` (usado neste ensaio). |
| 6 | Média | `backend/.env.example` sugeria `DB_SYNCHRONIZE=true` em dev local (contradiz a regra "nunca") e dizia que o backend fica em `api.myurbanai.com`, que não existe. | **Feita**. |
| 7 | Média | Docs não dizem como obter um usuário para logar localmente (sem seed/fixture documentado; Brevo e Stripe estão inativos). Não foi testado criar conta pela UI. | **Aberta**: documentar usuário de desenvolvimento ou rota/script de seed local. |
| 8 | Média | `down -v` aparece como forma normal de parar, mas apaga o banco **e** os volumes de `node_modules`; a próxima subida repete os ~32 min. | **Feita**: CONTRIBUTING diferencia `down` de `down -v`. |
| 9 | Baixa | Nenhum comando conferia pré-requisitos (Docker em execução, portas 3306/6379/10000/3000 livres). Neste computador havia 12+ containers de outros projetos. | **Feita**: `npm run doctor`. |
| 10 | Baixa | `runbooks/assuncao-operacional.md` está datado de 2026-05-13, sem acentos, com lista de validação própria (`tsc`, Jest) em vez de `validate-local.sh`, e fora do `ENSAIOS.md`. | **Proposta**: revisar ou marcar "Desatualizado". |
| 11 | Baixa | Números que derivam: `ENSAIOS.md` cita 57 migrations; hoje são 59. A arquitetura diz "última validação 2026-10-23" e cita ADRs 0010 a 0024 datados de 26/10. O índice de ADRs data o ADR 0007 em 24/04/2026 enquanto o README diz que o KNN foi removido em 2026-10. | **Proposta**: citar contagens como "ordem de grandeza" ou gerar; alinhar datas. |
| 13 | Baixa | `slo-probe --self-test` impõe p95 <= 500 ms e falha em máquina carregada (689 ms medido); passa ao reexecutar. | **Proposta**: afrouxar o limite no self-test ou medir só o formato do relatório. |
| 12 | Média | Código: `?page=abc` nas listagens admin (waitlist, contatos, comunicações, `eventsTimeline`) virava `OFFSET NaN` e erro 500. | **Feita** (task b). |

Não respondido pelos documentos (achados): como logar localmente (item 7); quem aprova PR e quem tem permissão de merge (a `main` não tem proteção, [pendência 14](./ARQUITETURA-ATUAL.md#9-pendências-conhecidas-genéricas)); como obter acesso a Railway/Stripe/Sentry de fato (os documentos dizem *qual* acesso pedir, não *a quem*); estado do incidente de segurança P0 ("tratado fora deste repositório").

## 4. As três tarefas entregues

Cada uma em seu commit, no estilo de quem chegou: pequena, útil, de baixo risco. Tempos aproximados de trabalho ativo (a máquina ficou ocupada pelo Compose e por um corte de rede durante a execução).

| Tarefa | Commit | Tempo | O que mudou |
|---|---|---|---|
| (c) Ferramenta: `npm run doctor` | `4b297d6` | ~15 min (boa parte esperando o Docker responder durante o boot) | `scripts/doctor.sh` somente leitura: Node, npm, git, hook de pre-push, Docker e Compose v2, portas (reconhece as do próprio Compose), `.env`, `uv` e `gitleaks`, aviso de conflito de `dist/`. Alias no `package.json`, entrada na allowlist do `public-scope-guard` e menção no CONTRIBUTING. Executado com o ambiente no ar: 0 falhas, 3 avisos esperados. |
| (b) Backend: `clampInt` para paginação | `e8f1487` | ~30 min (≈5 min de `npm ci` no host) | Helper `src/common/clamp-int.ts` e uso em `waitlist`, `contact-submissions`, `communications` e `eventsTimeline`. `Math.max(1, NaN)` é `NaN`; agora cai no valor padrão. Testes do helper e de regressão dos serviços. Fora de `src/connect/**` e do front. |
| (a) Docs: README/CONTRIBUTING | `71d46b7` | ~10 min | Itens 1, 2, 4, 6 e 8 da seção 3. |

O código novo do item (b) segue o padrão que já existia em `event-dedup-admin.service.ts` (um `clampInt` privado); unificar esse com o helper comum é um próximo passo seguro.

## 5. Validação

Rodado `scripts/validate-local.sh --root --backend` com o Compose derrubado (para não colidir em `dist/`):

```
total=36 falhas=1  (35 etapas = 0)
root:slo-probe-self-test=1   <- falso negativo, ver abaixo
backend:npm-ci / npm-audit / lint / tsc / body-dtos / jest = 0
backend:contract-openapi / coverage-certified = 0
backend:lgpd / observability / authorization / cron-strict / migrations-strict = 0 (e seus self-tests)
backend:backup-dry / backup-self-test / restore-verify-self-test = 0
backend:nest-build / dist-main = 0
root:security-head / docs-links / public-scope / resilience-dr / knn-legacy = 0
root:npm-ci / npm-audit / release-evidence-dry / enterprise-gate-dry = 0
```

O único vermelho foi `root:slo-probe-self-test`: o self-test afirma p95 <= 500 ms em requisições a um servidor local e mediu 689 ms com a máquina sobrecarregada pelo `npm ci` anterior; **reexecutado isolado passou** (`SLO probe self-test passed: 12/12`). Nenhum arquivo tocado por este ensaio participa dessa etapa. É a fricção 13 (teste dependente de relógio). Após as alterações finais de docs e da allowlist, `public-scope-guard` (self-test e real), `audit-document-links` (124 arquivos, 316 links) e `security-head-scan` também passaram.

## 6. Veredito

**Um time novo consegue assumir? Parcial.**

Consegue **entender** (produto, arquitetura, fluxo de dados e decisões em poucos minutos), **subir** localmente sem pedir nada a ninguém (provado: migrations, `/health/live` 200, home 200, derrubada limpa), **validar** uma mudança com um comando e **entregar** mudanças pequenas com testes e gates verdes. Isso é bem mais do que a maioria dos repositórios oferece.

O que falta para "sim":

1. **Usuário/seed local** para exercitar o app depois de subir (item 7).
2. **Versão de Node fixada** e flag para validar sem reinstalar (itens 3 e 5), e o `frontend` esperando o backend ficar saudável (item 2) para reduzir os ~40 min do primeiro boot.
3. **Acessos reais e pendências que dependem do dono**: este ensaio não cobre produção, staging, Stripe, Stays, AWS (o backup off-site está falhando), o incidente P0 aberto e a proteção da `main`. Um time novo só assume a operação depois de receber esses acessos e quitar essas pendências, que estão listadas em [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md#9-pendências-conhecidas-genéricas) e [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md).
4. Pequenas deriva de datas e contagens entre documentos (item 11) e um runbook antigo (item 10).

Repetir este ensaio quando os itens 1 a 3 forem resolvidos, e idealmente com uma pessoa de fora, em Linux, para comparar os tempos.
