import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminBetaOpsController } from './admin-beta-ops.controller';
import { SendBillingLinkDto } from './admin-beta-ops.dto';

describe('AdminBetaOpsController', () => {
  const billingHosts = { list: jest.fn().mockResolvedValue({ hosts: [] }), sendLink: jest.fn().mockResolvedValue({ ok: true }) };
  const outcomes = { comparison: jest.fn().mockResolvedValue({ rows: [] }) };
  let controller: AdminBetaOpsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminBetaOpsController(billingHosts as any, outcomes as any);
  });

  it('é admin-only: JwtAuthGuard + RolesGuard + @Roles("admin") na classe, sob /admin', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminBetaOpsController)).toBe('admin');
    expect(Reflect.getMetadata(ROLES_KEY, AdminBetaOpsController)).toEqual(['admin']);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminBetaOpsController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('expõe as três rotas esperadas', () => {
    const route = (name: keyof AdminBetaOpsController) => {
      const handler = AdminBetaOpsController.prototype[name] as (...args: unknown[]) => unknown;
      return [Reflect.getMetadata(METHOD_METADATA, handler), Reflect.getMetadata(PATH_METADATA, handler)];
    };
    expect(route('listBillingHosts')).toEqual([RequestMethod.GET, 'billing/hosts']);
    expect(route('sendBillingLink')).toEqual([RequestMethod.POST, 'billing/hosts/:userId/send-link']);
    expect(route('outcomesComparison')).toEqual([RequestMethod.GET, 'outcomes/comparison']);
  });

  it('só repassa filtros de status conhecidos', async () => {
    await controller.listBillingHosts('past_due', 'ana');
    expect(billingHosts.list).toHaveBeenLastCalledWith({ status: 'past_due', search: 'ana' });
    await controller.listBillingHosts('drop table', undefined);
    expect(billingHosts.list).toHaveBeenLastCalledWith({ status: 'all', search: undefined });
  });

  it('send-link usa "auto" por padrão', async () => {
    await controller.sendBillingLink('11111111-1111-4111-8111-111111111111', {} as any);
    expect(billingHosts.sendLink).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'auto');
  });

  it('DTO aceita só auto/portal/checkout', async () => {
    expect(await validate(plainToInstance(SendBillingLinkDto, { kind: 'portal' }))).toHaveLength(0);
    expect(await validate(plainToInstance(SendBillingLinkDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(SendBillingLinkDto, { kind: 'https://evil' }))).not.toHaveLength(0);
  });
});
