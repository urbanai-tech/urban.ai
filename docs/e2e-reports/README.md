# Relatórios E2E

Esta pasta é o destino do script `Urban-front-main/scripts/e2e-product-audit.js`, que grava o relatório de cada execução em `docs/e2e-reports/<timestamp>/` (`report.md` e `.json`). O job de produto do `ci.yml` publica a pasta como artefato `product-e2e-audit`.

As pastas por timestamp são ignoradas pelo Git; relatórios históricos não são versionados. Procedimento de uso: [`../runbooks/e2e-admin-host-tester-completo.md`](../runbooks/e2e-admin-host-tester-completo.md).
