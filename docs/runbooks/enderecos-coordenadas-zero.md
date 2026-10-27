# Endereços em 0,0 ou fora de faixa

## Por quê

No onboarding (`ConnectService.createMultipleAddressesWithScrapedInputs`), uma leitura do Airbnb sem
coordenadas (`latitude: null`) passava na checagem porque `Number(null) === 0`, e o endereço podia ser
salvo em 0,0 (Golfo da Guiné). A correção está em `src/common/coordinates.ts` (`parseCoordinates` /
`hasValidCoordinates`): null, vazio, NaN, infinito, 0,0 exato e valores fora de faixa
(lat ±90, lng ±180) são tratados como "sem coordenadas".

## Verificar se a produção tem linhas ruins (somente leitura)

A partir de `urban-ai-backend-main/`, com `DATABASE_URL` (ou `DB_*`) no ambiente ou em `.env`:

```bash
node scripts/check-address-coordinates.js            # contagem + amostra (até 200)
node scripts/check-address-coordinates.js --limit 1000
node scripts/check-address-coordinates.js --env-file ../caminho/.env
node scripts/check-address-coordinates.js --sql      # só imprime o SQL, sem conectar
```

O script só executa `SELECT` (sessão marcada READ ONLY). Código de saída: `0` sem ocorrências,
`2` com ocorrências, `1` erro.

SQL equivalente para rodar à mão:

```sql
SELECT id, cidade, estado, latitude, longitude, ativo
FROM addresses
WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
  AND ((latitude = 0 AND longitude = 0)
       OR latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180)
ORDER BY id;
```

## Se houver ocorrências

Este runbook não corrige dados. Decisão do dono: revisar a lista, e então mandar essas linhas de volta
para a geocodificação (ver [Backfill do geocoder](./backfill-geocoder.md)) ou reler o imóvel no Airbnb.
