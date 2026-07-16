# Atualização de segurança das dependências — 2026-07-15

## Resultado

O backend foi atualizado em grupos verificáveis, sem uso de `npm audit fix --force`:

- baseline de produção: 35 vulnerabilidades (24 moderadas e 11 altas);
- após correções compatíveis com o mesmo major: 16 (9 moderadas e 7 altas);
- após os upgrades coordenados: 0 vulnerabilidades no audit de produção e 0 no audit total.

Os números são um retrato do banco de advisories do npm na data acima e devem ser renovados continuamente no CI.

## Versões coordenadas

| Componente | Versão validada |
| --- | ---: |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing` | 11.1.28 |
| `@nestjs/swagger` | 11.4.5 |
| `@nestjs/typeorm` | 11.0.3 |
| `@nestjs/serve-static` | 5.0.5 |
| `@nestjs/config` | 4.0.4 |
| `@nestjs/jwt` | 11.0.2 |
| `@nestjs/passport` | 11.0.5 |
| `@nestjs/schedule` | 6.1.3 |
| `multer` | 2.2.0 |
| `bcrypt` | 6.0.0 |
| `uuid` | 11.1.1 |

`uuid` foi deduplicado por override para 11.1.1 porque Bull 4.16.5 e ExcelJS 4.4.0 ainda declaram a linha 8.x. Os dois consumidores usam a API `v4`, preservada na versão 11. A compatibilidade foi verificada com geração real de UUID, serialização de workbook e a suíte completa.

## Compatibilidade e contratos

- Nenhuma rota, DTO, guard, role, throttle ou formato de resposta foi alterado.
- A única adaptação de código do Nest 11 foi tipar `JWT_EXPIRES_IN` conforme a interface atual de `@nestjs/jwt`; o nome da variável e o padrão `15m` permanecem iguais.
- Multer 2.2.0 mantém os interceptors de upload usados pelo backend.
- bcrypt 6.0.0 preserva `hash` e `compare`; os testes de autenticação cobrem criação, login e migração de hashes legados.

## Gates executados

- `npm ls`: uma única linha coerente de Nest 11, Multer 2.2.0 e UUID 11.1.1.
- `npm run build`: aprovado.
- `npm test -- --runInBand`: 63 suítes e 461 testes aprovados.
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades.

## Manutenção

Não substituir esses upgrades por `npm audit fix --force` sem revisar peers, changelogs e contratos. Qualquer nova mudança major deve repetir build, suíte completa, testes de upload/autenticação e inspeção de `npm ls` antes de ser promovida.
