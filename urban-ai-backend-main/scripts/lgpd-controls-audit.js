#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const selfTest = process.argv.includes('--self-test');

if (selfTest) {
  runSelfTest();
  process.exit(0);
}

const contracts = [
  {
    file: 'src/auth/auth.controller.ts',
    checks: [
      ['self-delete requires JWT', /@UseGuards\(JwtAuthGuard\)\s*@Delete\('me'\)/],
      ['self-delete derives id from principal', /deleteUser\(req\.user\?\.userId\)/],
      ['admin delete requires JWT and RBAC', /@UseGuards\(JwtAuthGuard, RolesGuard\)\s*@Roles\('admin'\)\s*@Delete\(':id'\)/],
      ['cross-user lookup checks owner or admin', /requester\?\.userId !== id && requester\?\.role !== 'admin'/],
    ],
  },
  {
    file: 'src/auth/auth.service.ts',
    checks: [
      ['delete loads exact user id', /findOne\(\{ where: \{ id: userId \} \}\)/],
      ['missing user fails closed', /if \(!user\)[\s\S]{0,100}NotFoundException/],
      ['delete delegates to repository remove', /userRepository\.remove\(user\)/],
      ['user output is password-sanitized', /const \{ password, \.\.\.safe \}/],
    ],
  },
  {
    file: 'src/stays/stays.service.ts',
    checks: [
      ['server requires accepted consent', /input\.consentAccepted !== true/],
      ['server requires consent version', /!consentVersion/],
      ['consent timestamp persisted', /consentAcceptedAt = new Date\(\)|consentAcceptedAt: new Date\(\)/],
      ['consent version persisted', /consentVersion = consentVersion|consentVersion,/],
      ['consent context persisted', /consentIp[\s\S]{0,180}consentUserAgent/],
      ['disconnect clears external credential', /account\.accessToken = ''/],
    ],
    order: [
      ['consent is checked before external ping', 'input.consentAccepted !== true', 'connector.ping'],
    ],
  },
  {
    file: 'src/migrations/1780000000000-AddStaysConsentAuditFields.ts',
    checks: [
      ['consent timestamp column', /consentAcceptedAt/],
      ['consent version column', /consentVersion/],
      ['consent IP column', /consentIp/],
      ['consent user-agent column', /consentUserAgent/],
    ],
  },
  {
    file: 'src/migrations/1783600000000-PaymentUserCascadeOnDelete.ts',
    checks: [
      ['payment user cascade', /ON DELETE CASCADE ON UPDATE NO ACTION/],
      ['orphan rows fail closed', /orphan payment rows exist/],
      ['migration has rollback', /async down\(/],
    ],
  },
  {
    file: '../docs/runbooks/lgpd-data-subject-requests.md',
    checks: [
      ['export limitation is explicit', /exportacao consolidada[^\n]*nao implementada/i],
      ['anonymization limitation is explicit', /anonimizacao automatizada[^\n]*nao implementada/i],
      ['retention limitation is explicit', /retencao[^\n]*nao existe rotina automatizada/i],
      ['no real-data mutation in audit', /nao executa exclusao, exportacao ou anonimizacao/i],
    ],
  },
];

const failures = [];
let checked = 0;

for (const contract of contracts) {
  const file = path.resolve(root, contract.file);
  if (!fs.existsSync(file)) {
    failures.push(`${contract.file}: required file is missing`);
    continue;
  }
  const content = normalize(fs.readFileSync(file, 'utf8'));
  for (const [label, pattern] of contract.checks) {
    checked += 1;
    if (!pattern.test(content)) failures.push(`${contract.file}: missing contract "${label}"`);
  }
  for (const [label, before, after] of contract.order || []) {
    checked += 1;
    if (!appearsBefore(content, before, after)) {
      failures.push(`${contract.file}: invalid order for contract "${label}"`);
    }
  }
}

const entityAudit = auditUserRelations(path.join(root, 'src', 'entities'));
checked += entityAudit.relations.length;
for (const issue of entityAudit.issues) failures.push(issue);

if (failures.length > 0) {
  process.stderr.write('LGPD control gate failed:\n');
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `LGPD control gate passed: ${checked}/${checked} contracts; ` +
    `${entityAudit.relations.length} User relations have explicit CASCADE/SET NULL policy.\n`,
);

function auditUserRelations(entitiesRoot) {
  const relations = [];
  const issues = [];
  for (const file of walk(entitiesRoot).filter((candidate) => candidate.endsWith('.ts'))) {
    const content = fs.readFileSync(file, 'utf8');
    const pattern = /@(ManyToOne|OneToOne)\b/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const decorator = readDecorator(content, match.index + match[0].length);
      pattern.lastIndex = Math.max(pattern.lastIndex, decorator.endIndex);
      if (!/=>\s*User\b/.test(decorator.argument)) continue;
      const relative = path.relative(root, file).replace(/\\/g, '/');
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      const policy = /onDelete\s*:\s*['"](CASCADE|SET NULL)['"]/.exec(decorator.argument)?.[1];
      relations.push({ file: relative, line, policy: policy || null });
      if (!policy) issues.push(`${relative}:${line}: User relation lacks explicit onDelete policy`);
    }
  }
  return { relations, issues };
}

function readDecorator(content, startIndex) {
  let index = startIndex;
  while (/\s/.test(content[index] || '')) index += 1;
  if (content[index] !== '(') return { argument: '', endIndex: index };
  const start = index;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (; index < content.length; index += 1) {
    const char = content[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return { argument: content.slice(start + 1, index), endIndex: index + 1 };
      }
    }
  }
  return { argument: '', endIndex: startIndex };
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function appearsBefore(content, before, after) {
  const first = content.indexOf(before);
  const second = content.indexOf(after);
  return first >= 0 && second >= 0 && first < second;
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r\n/g, '\n');
}

function runSelfTest() {
  const checks = [];
  const check = (label, fn) => {
    fn();
    checks.push(label);
  };

  check('decorator parser reads nested relation callback', () => {
    const fixture = "@ManyToOne(() => User, (user) => user.items, { onDelete: 'CASCADE' })";
    const start = fixture.indexOf('@ManyToOne') + '@ManyToOne'.length;
    const parsed = readDecorator(fixture, start);
    assert.match(parsed.argument, /onDelete: 'CASCADE'/);
  });

  check('cascade relation is accepted', () => {
    const fixture = "() => User, { onDelete: 'CASCADE' }";
    assert.match(fixture, /onDelete\s*:\s*['"](CASCADE|SET NULL)['"]/);
  });

  check('relation without delete policy is rejected', () => {
    const fixture = '() => User, { eager: true }';
    assert.equal(/onDelete\s*:/.test(fixture), false);
  });

  check('consent order fails closed', () => {
    assert.equal(appearsBefore('check consent; connector.ping', 'check consent', 'connector.ping'), true);
    assert.equal(appearsBefore('connector.ping; check consent', 'check consent', 'connector.ping'), false);
  });

  check('normalization removes accent drift', () => {
    assert.equal(normalize('anonimização'), 'anonimizacao');
  });

  process.stdout.write(`LGPD control gate self-test passed: ${checks.length}/${checks.length} checks.\n`);
}
