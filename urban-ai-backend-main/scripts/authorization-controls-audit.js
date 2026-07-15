#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);
const MUTATING_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);

// Public mutation is exceptional. Every entry is exact, reviewed and must remain
// present in the source tree. Wildcards and prefix matching are intentionally absent.
const PUBLIC_MUTATION_ALLOWLIST = new Map([
  ['POST /auth/register', 'account bootstrap; strict per-route throttle'],
  ['POST /auth/waitlist/accept', 'single-use invitation token; strict per-route throttle'],
  ['POST /auth/login', 'credential exchange; strict per-route throttle'],
  ['POST /auth/google', 'Google identity-token exchange; strict per-route throttle'],
  ['POST /auth/refresh', 'rotating refresh cookie; strict per-route throttle'],
  ['POST /auth/logout', 'refresh-cookie revocation only; explicit per-route throttle'],
  ['POST /contact-submissions', 'public contact form; strict per-route throttle'],
  ['POST /email/verificar-usuario-state', 'account-state lookup; strict per-route throttle'],
  ['POST /email/enviar-codigo', 'verification-code delivery; strict per-route throttle'],
  ['POST /email/confirmar-email', 'verification-code exchange; strict per-route throttle'],
  ['POST /email/forgot-password', 'password-reset delivery; strict per-route throttle'],
  ['POST /email/update-password', 'password-reset token exchange; strict per-route throttle'],
  ['POST /payments/webhook', 'Stripe-signed webhook; signature verified fail-closed'],
  ['POST /waitlist', 'public prelaunch signup; strict per-route throttle'],
]);

const SIGNED_PUBLIC_ENDPOINTS = new Set(['POST /payments/webhook']);
const MACHINE_GUARDS = new Set(['EventsIngestApiKeyGuard']);

// Authenticated computations that do not select or mutate a persisted resource
// belonging to a user. This is not a public allowlist.
const AUTHENTICATED_NON_RESOURCE_ALLOWLIST = new Map([
  ['POST /propriedades/airbnb/create-alert', 'authenticated geospatial calculation without target resource id'],
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function decoratorInfo(decorator, sourceFile) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) {
    return {
      name: expression.expression.getText(sourceFile),
      args: expression.arguments.map((argument) => argument.getText(sourceFile)),
    };
  }
  return { name: expression.getText(sourceFile), args: [] };
}

function literalValue(raw) {
  if (!raw || !/^['"`]/.test(raw)) return '';
  return raw.slice(1, -1);
}

function joinRoute(base, route) {
  const segments = [base, route]
    .filter(Boolean)
    .flatMap((segment) => segment.split('/'))
    .filter(Boolean);
  return `/${segments.join('/')}` || '/';
}

function collectRoutes(sourceFiles) {
  const routes = [];
  for (const [file, text] of sourceFiles) {
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const classDecorators = decorators(statement).map((item) => decoratorInfo(item, sourceFile));
      const controller = classDecorators.find((item) => item.name === 'Controller');
      if (!controller) continue;

      const base = literalValue(controller.args[0]);
      const classGuards = classDecorators
        .filter((item) => item.name === 'UseGuards')
        .flatMap((item) => item.args);
      const classRoles = classDecorators
        .filter((item) => item.name === 'Roles')
        .flatMap((item) => item.args.map(literalValue));
      const classThrottle = classDecorators.some((item) => item.name === 'Throttle');

      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const methodDecorators = decorators(member).map((item) => decoratorInfo(item, sourceFile));
        const http = methodDecorators.find((item) => HTTP_DECORATORS.has(item.name));
        if (!http) continue;

        const methodGuards = methodDecorators
          .filter((item) => item.name === 'UseGuards')
          .flatMap((item) => item.args);
        const methodRoles = methodDecorators
          .filter((item) => item.name === 'Roles')
          .flatMap((item) => item.args.map(literalValue));
        const route = joinRoute(base, literalValue(http.args[0]));
        const methodBody = member.body ? member.body.getText(sourceFile) : '';
        const guards = [...classGuards, ...methodGuards];
        const roles = [...classRoles, ...methodRoles].filter(Boolean);
        const key = `${http.name.toUpperCase()} ${route}`;

        routes.push({
          key,
          verb: http.name.toUpperCase(),
          route,
          mutable: MUTATING_DECORATORS.has(http.name),
          admin:
            route.split('/').filter(Boolean).includes('admin') ||
            /^Admin/.test(statement.name?.text || '') ||
            roles.length > 0,
          guards,
          roles,
          throttled: classThrottle || methodDecorators.some((item) => item.name === 'Throttle'),
          ownerBound:
            /\b(?:req|request)\??\.user\??\.(?:userId|id)\b/.test(methodBody) ||
            /\brequester\??\.(?:userId|id)\b/.test(methodBody),
          hasResourceInput:
            /:[A-Za-z][A-Za-z0-9_]*/.test(route) ||
            /@Body\s*\(/.test(member.getText(sourceFile)),
          handler: member.name.getText(sourceFile),
          file,
          line: sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1,
        });
      }
    }
  }
  return routes;
}

function audit(sourceFiles, auxiliarySources = {}) {
  const routes = collectRoutes(sourceFiles);
  const findings = [];
  const keys = new Set(routes.map((route) => route.key));

  for (const route of routes) {
    const hasJwt = route.guards.some((guard) => /\bJwtAuthGuard\b/.test(guard));
    const hasRolesGuard = route.guards.some((guard) => /\bRolesGuard\b/.test(guard));
    const hasMachineAuth = route.guards.some((guard) =>
      [...MACHINE_GUARDS].some((allowed) => new RegExp(`\\b${allowed}\\b`).test(guard)),
    );
    const isPublicAllowed = PUBLIC_MUTATION_ALLOWLIST.has(route.key);

    if (route.admin) {
      if (!hasJwt) findings.push(`${route.key}: administrative route lacks JwtAuthGuard`);
      if (!hasRolesGuard) findings.push(`${route.key}: administrative route lacks RolesGuard`);
      if (!route.roles.some((role) => role === 'admin' || role === 'support')) {
        findings.push(`${route.key}: administrative route lacks explicit admin/support role`);
      }
    }

    if (!route.mutable) continue;

    if (!hasJwt && !hasMachineAuth && !isPublicAllowed) {
      findings.push(`${route.key}: mutable route is unauthenticated and not explicitly public`);
    }

    if (isPublicAllowed && !SIGNED_PUBLIC_ENDPOINTS.has(route.key) && !route.throttled) {
      findings.push(`${route.key}: public mutation lacks an explicit @Throttle control`);
    }

    if (
      hasJwt &&
      !route.admin &&
      route.hasResourceInput &&
      !route.ownerBound &&
      !AUTHENTICATED_NON_RESOURCE_ALLOWLIST.has(route.key)
    ) {
      findings.push(`${route.key}: authenticated resource mutation is not bound to req.user ownership`);
    }

    if (hasMachineAuth && !route.throttled) {
      findings.push(`${route.key}: machine-authenticated mutation lacks an explicit @Throttle control`);
    }
  }

  for (const key of PUBLIC_MUTATION_ALLOWLIST.keys()) {
    if (!keys.has(key)) findings.push(`${key}: stale public allowlist entry`);
  }
  for (const key of AUTHENTICATED_NON_RESOURCE_ALLOWLIST.keys()) {
    if (!keys.has(key)) findings.push(`${key}: stale authenticated non-resource allowlist entry`);
  }

  const appModule = auxiliarySources.appModule || '';
  if (!/provide:\s*APP_GUARD[\s\S]{0,160}useClass:\s*ThrottlerGuard/.test(appModule)) {
    findings.push('global throttle: AppModule does not register ThrottlerGuard as APP_GUARD');
  }

  const paymentsService = auxiliarySources.paymentsService || '';
  if (
    !/STRIPE_WEBHOOK_SECRET\s+not configured/.test(paymentsService) ||
    !/stripe-signature header missing/.test(paymentsService) ||
    !/webhooks\.constructEvent\(rawBody,\s*signature,\s*endpointSecret\)/.test(paymentsService)
  ) {
    findings.push('POST /payments/webhook: Stripe signature verification is not demonstrably fail-closed');
  }

  if (auxiliarySources.ownershipSources) {
    const ownershipContracts = [
      {
        name: 'notification mutation compares record owner',
        source: auxiliarySources.ownershipSources.notifications,
        pattern: /notification\.user\.id\s*!==\s*userId/,
      },
      {
        name: 'property mutations query address and authenticated owner together',
        source: auxiliarySources.ownershipSources.properties,
        pattern: /where:\s*\{\s*id:\s*addressId,\s*user:\s*\{\s*id:\s*userId\s*\}/,
      },
      {
        name: 'host property operations resolve owned addresses',
        source: auxiliarySources.ownershipSources.hostPanels,
        pattern: /async\s+getOwnedAddresses\([\s\S]{0,500}user:\s*\{\s*id:\s*userId\s*\}[\s\S]{0,160}list:\s*\{\s*user:\s*\{\s*id:\s*userId\s*\}/,
      },
      {
        name: 'pricing suggestions reject a different owner',
        source: auxiliarySources.ownershipSources.suggestions,
        pattern: /registro\.usuarioProprietario\.id\s*!==\s*userId/,
      },
      {
        name: 'Stays rollback scopes update id to authenticated owner',
        source: auxiliarySources.ownershipSources.stays,
        pattern: /where:\s*\{\s*id:\s*priceUpdateId,\s*user:\s*\{\s*id:\s*userId\s*\}\s*\}/,
      },
    ];
    for (const contract of ownershipContracts) {
      if (!contract.pattern.test(contract.source || '')) {
        findings.push(`ownership contract missing: ${contract.name}`);
      }
    }
  }

  return { routes, findings };
}

function fixture(source) {
  return [['fixture.controller.ts', source]];
}

function runSelfTest() {
  const appModule = 'provide: APP_GUARD, useClass: ThrottlerGuard';
  const paymentsService = [
    'STRIPE_WEBHOOK_SECRET not configured',
    'stripe-signature header missing',
    'webhooks.constructEvent(rawBody, signature, endpointSecret)',
  ].join('\n');
  const auxiliary = { appModule, paymentsService };
  const cases = [
    {
      name: 'accepts JWT owner-bound mutation',
      source: `@Controller('items') class ItemsController {
        @UseGuards(JwtAuthGuard) @Patch(':id') update(@Req() req, @Body() body) {
          return this.service.update(req.user.userId, body);
        }
      }`,
      expected: null,
    },
    {
      name: 'rejects unlisted public mutation',
      source: `@Controller('items') class ItemsController { @Post() create(@Body() body) { return body; } }`,
      expected: 'unauthenticated and not explicitly public',
    },
    {
      name: 'rejects admin route without RBAC',
      source: `@Controller('admin/jobs') class JobsController { @UseGuards(JwtAuthGuard) @Post('run') run() {} }`,
      expected: 'lacks RolesGuard',
    },
    {
      name: 'rejects nested administrative reads without RBAC',
      source: `@Controller('tools') class ToolsController { @Get('admin/status') status() {} }`,
      expected: 'lacks JwtAuthGuard',
    },
    {
      name: 'rejects IDOR-prone resource mutation',
      source: `@Controller('items') class ItemsController {
        @UseGuards(JwtAuthGuard) @Delete(':id') remove(@Param('id') id) { return this.service.remove(id); }
      }`,
      expected: 'not bound to req.user ownership',
    },
    {
      name: 'rejects machine mutation without explicit throttle',
      source: `@Controller('events') class EventsController {
        @UseGuards(EventsIngestApiKeyGuard) @Post('ingest') ingest(@Body() body) { return body; }
      }`,
      expected: 'lacks an explicit @Throttle',
    },
  ];

  let passed = 0;
  for (const item of cases) {
    const result = audit(fixture(item.source), auxiliary);
    const relevant = result.findings.filter(
      (finding) => !finding.includes('stale public allowlist') && !finding.includes('stale authenticated'),
    );
    const ok = item.expected
      ? relevant.some((finding) => finding.includes(item.expected))
      : relevant.length === 0;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${item.name}`);
    if (!ok) {
      console.error(`  findings: ${relevant.join(' | ') || '(none)'}`);
      process.exitCode = 1;
    } else {
      passed += 1;
    }
  }
  console.log(`Authorization audit self-test: ${passed}/${cases.length} passed`);
}

function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const controllerFiles = walk(SRC).filter(
    (file) => file.endsWith('.controller.ts') && !file.endsWith('.spec.ts'),
  );
  const sourceFiles = controllerFiles.map((file) => [file, fs.readFileSync(file, 'utf8')]);
  const result = audit(sourceFiles, {
    appModule: fs.readFileSync(path.join(SRC, 'app.module.ts'), 'utf8'),
    paymentsService: fs.readFileSync(path.join(SRC, 'payments', 'payments.service.ts'), 'utf8'),
    ownershipSources: {
      notifications: fs.readFileSync(path.join(SRC, 'notifications', 'notifications.service.ts'), 'utf8'),
      properties: fs.readFileSync(path.join(SRC, 'propriedades', 'propriedade.service.ts'), 'utf8'),
      hostPanels: fs.readFileSync(path.join(SRC, 'host-panels', 'host-panels.service.ts'), 'utf8'),
      suggestions: fs.readFileSync(path.join(SRC, 'sugestao', 'sugestion.service.ts'), 'utf8'),
      stays: fs.readFileSync(path.join(SRC, 'stays', 'stays.service.ts'), 'utf8'),
    },
  });

  if (process.argv.includes('--inventory')) {
    for (const route of result.routes.filter((item) => item.mutable || item.admin)) {
      console.log(
        `${route.key}\tadmin=${route.admin}\tguards=${route.guards.join(',') || '-'}\t` +
          `roles=${route.roles.join(',') || '-'}\tthrottle=${route.throttled}\towner=${route.ownerBound}\t` +
          `${path.relative(ROOT, route.file)}:${route.line}`,
      );
    }
  }

  if (result.findings.length) {
    console.error(`Authorization audit failed (${result.findings.length} finding(s)):`);
    for (const finding of result.findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  const mutable = result.routes.filter((route) => route.mutable).length;
  const administrative = result.routes.filter((route) => route.admin).length;
  console.log(
    `Authorization audit passed: ${mutable} mutable routes, ${administrative} administrative routes, ` +
      `${PUBLIC_MUTATION_ALLOWLIST.size} exact public exceptions.`,
  );
}

main();
