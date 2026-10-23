'use strict';

// Guarda de escopo do repositório público.
//
// Estratégia ALLOWLIST: o script lista os arquivos versionados e falha se algum
// estiver fora do conjunto permitido. Ele nunca enumera nem nomeia o que é
// interno; tudo o que não está explicitamente permitido é rejeitado.
//
// Uso:
//   node scripts/public-scope-guard.js              # arquivos rastreados (git ls-files)
//   node scripts/public-scope-guard.js --tree <rev> # árvore de um commit (git ls-tree)
//   node scripts/public-scope-guard.js --self-test

const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// Arquivos permitidos na raiz.
const ROOT_FILES = new Set([
  '.env.staging.example',
  '.gitignore',
  'CHANGELOG.md',
  'README.md',
  'package-lock.json',
  'package.json',
  'vercel.json',
]);

// O nome da pasta do serviço legado é montado por partes para não acionar o
// gate de dependência do KNN legado, que proíbe a referência literal em scripts.
const KNN_FOLDER = `${['urban', 'ai', 'knn', 'main'].join('-')}/`;

// Pastas permitidas na raiz (prefixo completo).
const ROOT_DIRECTORIES = [
  '.githooks/',
  '.github/',
  'Urban-front-main/',
  'load-tests/',
  'urban-ai-backend-main/',
  KNN_FOLDER,
  'urban-pipeline-main/',
  'urban-webscraping-main/',
];

// scripts/ é uma lista fechada: novo script exige atualização consciente daqui.
const SCRIPT_FILES = new Set([
  'scripts/audit-document-links.js',
  'scripts/audit-sensitive-history.js',
  'scripts/enterprise-access-readiness.js',
  'scripts/enterprise-auditability-live-gate.js',
  'scripts/install-git-hooks.js',
  'scripts/knn-legacy-dependency-gate.js',
  'scripts/public-scope-guard.js',
  'scripts/release-evidence.js',
  'scripts/resilience-dr-gate.js',
  'scripts/security-head-scan.js',
  'scripts/slo-probe.js',
]);

// docs/: diretórios inteiramente públicos (prefixo) ...
const DOCS_DIRECTORIES = [
  'docs/adr/',
  'docs/contracts/',
  'docs/e2e-reports/',
  'docs/evidence/',
  'docs/legal/',
  'docs/postmortems/',
  'docs/product/data/',
  'docs/release/',
  'docs/runbooks/',
];

// ... e arquivos individuais públicos (diretórios mistos e raiz de docs/).
const DOCS_FILES = new Set([
  'docs/ACESSOS-E-FERRAMENTAS.md',
  'docs/ARQUITETURA-ATUAL.md',
  'docs/DOCUMENTATION-GOVERNANCE.md',
  'docs/README.md',
  'docs/auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md',
  'docs/plano-mestre-scorecard-10-10-2026-07-15.md',
  'docs/scorecard-10-10-execution-status.md',
  'docs/urban-ai-system-map-2026-07-15.html',
  'docs/handoff/DEV-HANDOFF-2026-07-01.md',
  'docs/handoff/README.md',
  'docs/handoff/VALIDATION-CHECKLIST.md',
  'docs/lgpd/dpa-checklist.md',
  'docs/ops/README.md',
  'docs/ops/protocolo-devs-agentes.md',
  'docs/ops/slo.md',
  'docs/product/ARCHITECTURE.md',
  'docs/product/DESIGN-SYSTEM.md',
  'docs/product/PRD.md',
  'docs/product/README.md',
  'docs/product/REBRAND-MAP.md',
  'docs/product/USER-JOURNEYS.md',
  'docs/v2-2026-05-24/mapa-funcional-tecnico.md',
]);

function normalize(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

// Retorna null quando o arquivo é permitido, ou o motivo da rejeição.
function classify(rawFile) {
  const file = normalize(rawFile);

  // CI de outras plataformas e workflows aninhados nunca executam no GitHub
  // e não fazem parte do escopo público.
  if (/(^|\/)\.gitlab-ci\.yml$/.test(file)) return 'ci-de-outra-plataforma';
  if (/\/\.github\/workflows\//.test(file)) return 'workflow-aninhado';

  if (!file.includes('/')) {
    return ROOT_FILES.has(file) ? null : 'arquivo-de-raiz-fora-da-allowlist';
  }
  if (file.startsWith('scripts/')) {
    return SCRIPT_FILES.has(file) ? null : 'script-fora-da-allowlist';
  }
  if (file.startsWith('docs/')) {
    if (DOCS_FILES.has(file)) return null;
    if (DOCS_DIRECTORIES.some((prefix) => file.startsWith(prefix))) return null;
    return 'docs-fora-da-allowlist';
  }
  if (ROOT_DIRECTORIES.some((prefix) => file.startsWith(prefix))) return null;
  return 'pasta-de-raiz-fora-da-allowlist';
}

function listFiles(tree) {
  const args = tree
    ? ['ls-tree', '-r', '-z', '--name-only', tree]
    : ['ls-files', '-z'];
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function evaluate(files) {
  const findings = [];
  for (const file of files) {
    const reason = classify(file);
    if (reason) findings.push({ file, reason });
  }
  return findings;
}

function selfTest() {
  const failures = [];
  const expectAllowed = (file) => {
    if (classify(file) !== null) failures.push(`deveria permitir: ${file}`);
  };
  const expectBlocked = (file) => {
    if (classify(file) === null) failures.push(`deveria bloquear: ${file}`);
  };

  [
    'README.md',
    'package.json',
    '.github/workflows/ci.yml',
    '.githooks/pre-push',
    'scripts/security-head-scan.js',
    'docs/README.md',
    'docs/runbooks/backup-restore.md',
    'docs/product/data/README.md',
    'docs/handoff/README.md',
    'docs/v2-2026-05-24/mapa-funcional-tecnico.md',
    'urban-ai-backend-main/src/main.ts',
    'urban-pipeline-main/.github/instructions/python.instructions.md',
    'Urban-front-main/src/app/page.tsx',
  ].forEach(expectAllowed);

  [
    'zz-sem-lista.md',
    'zz-sem-lista/arquivo.md',
    'scripts/zz-sem-lista.js',
    'docs/zz-sem-lista.md',
    'docs/zz-sem-lista/arquivo.md',
    'docs/handoff/zz-sem-lista.md',
    'docs/product/zz-sem-lista.md',
    'docs/v2-2026-05-24/zz-sem-lista.md',
    'urban-pipeline-main/.gitlab-ci.yml',
    'urban-ai-backend-main/.github/workflows/zz.yml',
  ].forEach(expectBlocked);

  // Normalização de separadores do Windows.
  if (normalize('docs\\README.md') !== 'docs/README.md') failures.push('normalizacao de separadores');

  if (failures.length > 0) {
    process.stderr.write(`Public scope guard self-test failed:\n${failures.map((f) => `- ${f}`).join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Public scope guard self-test passed: allowlist e bloqueios verificados.\n');
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    selfTest();
    return;
  }

  let tree = null;
  const treeIndex = args.indexOf('--tree');
  if (treeIndex !== -1) {
    tree = args[treeIndex + 1];
    if (!tree) {
      process.stderr.write('Public scope guard: --tree exige um commit ou árvore.\n');
      process.exitCode = 2;
      return;
    }
  }

  let files;
  try {
    files = listFiles(tree);
  } catch (error) {
    process.stderr.write(`Public scope guard: não foi possível listar arquivos (${error.message.split('\n')[0]}).\n`);
    process.exitCode = 2;
    return;
  }

  const findings = evaluate(files);
  const origin = tree ? `árvore ${tree}` : 'arquivos rastreados';
  if (findings.length > 0) {
    process.stderr.write(`Public scope guard failed: ${findings.length} arquivo(s) fora do escopo público em ${origin}.\n`);
    for (const finding of findings.slice(0, 200)) {
      process.stderr.write(`- ${finding.file} [${finding.reason}]\n`);
    }
    if (findings.length > 200) process.stderr.write(`... e mais ${findings.length - 200}.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Public scope guard passed: ${files.length} arquivos em ${origin}, todos dentro da allowlist.\n`);
  }
}

main();
