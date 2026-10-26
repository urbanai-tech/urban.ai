# ADR 0022 — Vercel e fluxo "bronze" S3 do Prefect: manter ou desligar

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: Engenharia/Operação (Gustavo). Complementa os adendos dos ADRs [0003](./0003-prefect-cloud.md) e [0005](./0005-hospedagem-railway.md).

## Contexto — o que o repositório mostra

**Vercel**
- O produto roda no Railway ([ADR 0005](./0005-hospedagem-railway.md)). O `vercel.json` da raiz apenas desliga deploys por Git (`git.deploymentEnabled: false`). O front só trata hosts `*.vercel.app` como ambiente local no `middleware.ts`. Nenhum workflow nem documento mostra um deploy ativo no Vercel; a única menção operacional é em `ACESSOS-E-FERRAMENTAS.md` ("apenas se alguma peça auxiliar vier a ser publicada").
- **"Questboard"**: o nome **não aparece em nenhum arquivo versionado** (busca em todo o repositório). Se existe um projeto com esse nome no Vercel, ele está fora deste repositório e não pode ser avaliado a partir daqui; **a confirmação precisa vir de quem administra a conta do Vercel**.

**Fluxo bronze (Prefect → S3 → MySQL)**
- O deployment `raw_data_extraction_and_dump` (04:00 UTC, `urban-pipeline-main/serve.py` e `prefect.yaml`) lê arquivos do S3. As pipelines S3 do webscraping estão **comentadas** (`urban-webscraping-main/urban_webscrapping/settings.py`) e bucket/prefixo de escrita e leitura não coincidem. Logo, o flow roda sem dados novos. O caminho vivo é coletor/spider → `POST /events/ingest` ([ADR 0018](./0018-entrega-confiavel-dos-coletores-outbox-sqlite.md)). O outro deployment do Prefect (`urban_webscraping`, 03:00 UTC) é o gatilho dos spiders e segue útil.
- Manter o flow custa credenciais AWS no Prefect (Secret blocks), um container que precisa estar de pé e confusão para quem lê a arquitetura.

## Opções consideradas

**Vercel**: (a) manter o `vercel.json` como está (barreira contra deploy acidental); (b) remover o arquivo e a menção; (c) usar o Vercel para algo novo, com ADR próprio.
**Bronze**: (a) reativar com bucket/prefixo alinhados; (b) desligar o deployment e arquivar o código do flow; (c) deixar como está.

## Recomendação

- **Vercel**: opção (a) agora. O arquivo é inofensivo e protege contra um deploy duplicado se alguém conectar o repositório ao Vercel. Confirmar com o administrador da conta se há projeto (inclusive "Questboard") e, se não houver, desconectar e então remover `vercel.json` (b), atualizando `public-scope-guard.js`, o README e os ADRs.
- **Bronze**: opção (b). Os dados já chegam pelo caminho de ingest com outbox, que é mais confiável e tem quarentena; um data lake bruto só se justifica quando houver consumidor (treino de modelo, auditoria de fonte). Quando houver, reativar (a) com bucket alinhado e **um** produtor. Ao desligar: remover o deployment de `serve.py`/`prefect.yaml`, aposentar as credenciais AWS do pipeline (se o S3 de **backup** continuar, ele usa credenciais próprias do GitHub Actions) e atualizar [`ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md).

## Consequências

- (+) Menos peças para entender, menos credenciais espalhadas, arquitetura que descreve o que de fato roda.
- (−) Desligar o bronze remove a possibilidade de reprocessar dados brutos históricos de forma barata; a regravação do histórico depende de recoletar.
- (−) Enquanto pendente, a documentação precisa continuar avisando que o flow está inativo.
