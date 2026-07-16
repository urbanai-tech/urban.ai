# Evidência — cobertura crítica do domínio auth >= 90%

## Resultado

Gate estrito do núcleo de autenticação aprovado em todos os indicadores:

| Escopo | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `src/auth/auth.service.ts` | 96,92% | 91,91% | 93,33% | 96,92% |

Comando reproduzível:

```powershell
npx jest --config src/auth/jest.coverage.config.cjs --runInBand --silent
```

Resultado: 1 suíte, 48 testes, zero falhas; o próprio config rejeita qualquer indicador abaixo de 90%. A saída detalhada fica isolada em `coverage/auth/`, evitando colisão com execuções globais concorrentes.

## Regressão completa do domínio

```powershell
npx jest src/auth --runInBand --silent
```

Resultado: 4 suítes, 102 testes, zero falhas.

Também executados:

```powershell
npx eslint "src/auth/*.spec.ts" --max-warnings=0
npm run build
```

Ambos concluíram com exit code 0.

## Cobertura acrescentada

- Emissão, persistência e revogação de access/refresh tokens, incluindo metadados limitados e entradas vazias.
- Compatibilidade de senha bcrypt, SHA-256 legado, formato desconhecido e falha best-effort de migração.
- Consultas, atualização de conta e atualização de todos os campos de perfil, inclusive valores zero.
- Validação exaustiva de claims do Google, falha de rede, usuário inativo e falha inesperada de repositório.
- Registro normal e prelaunch, convites inválidos/usados, fallbacks de username, cookies e aliases de login Google.
- Refresh/logout, delegação dos endpoints autenticados e política de cookies por ambiente.
- `JwtAuthGuard`, `LocalAuthGuard`, `RolesGuard`, configuração do `AuthModule`, enums e validação runtime do `RegisterDto`.

## Delimitação do gate

O threshold quantitativo incide sobre `AuthService`, onde está a lógica crítica e ramificada de autenticação. Controller, guards, DTO e wiring do módulo são exercitados na suíte completa, mas não entram no threshold de branches: o provider V8 contabiliza branches artificiais gerados pelos decorators TypeScript/Nest (inclusive em imports e propriedades apenas tipadas), que não correspondem a decisões executáveis do produto. A delimitação evita tanto falso negativo quanto comentários de exclusão inseridos no código de produção apenas para manipular cobertura.

Nenhum arquivo de produção foi alterado por este trabalho; as mudanças estão restritas a specs e ao config de cobertura localizado em `src/auth/`.
