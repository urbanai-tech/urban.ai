import * as fs from 'fs';
import * as path from 'path';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ADMIN_AUDIT_EXPLICIT_KEY, ADMIN_AUDIT_SKIP_KEY } from './admin-audit.decorator';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditModule } from './admin-audit.module';

// Dependências ESM-only puxadas pelos services dos controllers; aqui só importa a metadata.
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('@turf/turf', () => ({}));

/**
 * Guarda de regressão: TODA mutação administrativa (@Roles('admin'|'support') em
 * POST/PUT/PATCH/DELETE) precisa gerar trilha de auditoria. A cobertura vem de:
 *  - interceptor global (APP_INTERCEPTOR em AdminAuditModule), ou
 *  - registro explícito no handler (@AdminAuditedInHandler + audit.record).
 * Um novo endpoint admin sem nenhum dos dois só passa se ganhar @SkipAdminAudit,
 * o que este teste (e `npm run audit:authorization`) reprova.
 */
const SRC = path.resolve(__dirname, '..');
const MUTATING = new Set([RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE]);

function controllerFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : controllerFiles(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });
}

type AdminMutation = { id: string; handler: Function; explicit: boolean; skipped: boolean };

function collectAdminMutations(): AdminMutation[] {
  const found: AdminMutation[] = [];
  for (const file of controllerFiles(SRC)) {
    const mod = require(file);
    for (const exported of Object.values(mod) as any[]) {
      if (typeof exported !== 'function' || Reflect.getMetadata(PATH_METADATA, exported) === undefined) continue;
      const classRoles: string[] = Reflect.getMetadata(ROLES_KEY, exported) ?? [];
      for (const name of Object.getOwnPropertyNames(exported.prototype)) {
        const handler = exported.prototype[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined || !MUTATING.has(method)) continue;
        const roles: string[] = Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles;
        if (!roles.some((role) => role === 'admin' || role === 'support')) continue;
        found.push({
          id: `${exported.name}.${name}`,
          handler,
          explicit: Reflect.getMetadata(ADMIN_AUDIT_EXPLICIT_KEY, handler) === true,
          skipped: Boolean(Reflect.getMetadata(ADMIN_AUDIT_SKIP_KEY, handler)),
        });
      }
    }
  }
  return found;
}

describe('cobertura de auditoria das mutações administrativas', () => {
  const mutations = collectAdminMutations();

  it('enumera as rotas admin mutáveis (sanidade da reflexão)', () => {
    expect(mutations.length).toBeGreaterThan(30);
    const ids = mutations.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['AuthController.updateUser', 'AuthController.deleteUser']));
  });

  it('o interceptor de auditoria está registrado globalmente', () => {
    const providers: any[] = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AdminAuditModule);
    expect(providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor })]),
    );
  });

  it('nenhuma mutação admin opta por ficar fora da auditoria', () => {
    expect(mutations.filter((m) => m.skipped).map((m) => m.id)).toEqual([]);
  });

  it('handlers marcados como auditoria explícita realmente chamam audit.record', () => {
    const lying = mutations.filter((m) => m.explicit && !/audit\.record\(/.test(m.handler.toString()));
    expect(lying.map((m) => m.id)).toEqual([]);
  });
});
