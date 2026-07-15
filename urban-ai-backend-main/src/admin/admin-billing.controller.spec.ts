import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminBillingController } from './admin-billing.controller';

function routeMetadata(method: keyof AdminBillingController) {
  const handler = AdminBillingController.prototype[method] as (...args: unknown[]) => unknown;
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler),
    requestMethod: Reflect.getMetadata(METHOD_METADATA, handler),
  };
}

describe('AdminBillingController', () => {
  const finance = {
    overview: jest.fn(),
    listCosts: jest.fn(),
    createCost: jest.fn(),
    updateCost: jest.fn(),
    deleteCost: jest.fn(),
    seedDefaultCosts: jest.fn(),
    listPlans: jest.fn(),
    updatePlanPricing: jest.fn(),
  };
  const stripeSync = { check: jest.fn() };
  const audit = { record: jest.fn() };
  let controller: AdminBillingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminBillingController(finance as any, stripeSync as any, audit as any);
  });

  it('preserves every billing and finance route under /admin', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminBillingController)).toBe('admin');
    expect(Reflect.getMetadata(ROLES_KEY, AdminBillingController)).toEqual(['admin']);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminBillingController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);

    expect(routeMetadata('financeOverview')).toEqual({
      path: 'finance/overview',
      requestMethod: RequestMethod.GET,
    });
    expect(routeMetadata('listCosts')).toEqual({
      path: 'finance/costs',
      requestMethod: RequestMethod.GET,
    });
    expect(routeMetadata('createCost')).toEqual({
      path: 'finance/costs',
      requestMethod: RequestMethod.POST,
    });
    expect(routeMetadata('updateCost')).toEqual({
      path: 'finance/costs/:id',
      requestMethod: RequestMethod.PATCH,
    });
    expect(routeMetadata('deleteCost')).toEqual({
      path: 'finance/costs/:id',
      requestMethod: RequestMethod.DELETE,
    });
    expect(routeMetadata('seedDefaultCosts')).toEqual({
      path: 'finance/costs/seed',
      requestMethod: RequestMethod.POST,
    });
    expect(routeMetadata('listPlansConfig')).toEqual({
      path: 'plans-config',
      requestMethod: RequestMethod.GET,
    });
    expect(routeMetadata('updatePlanPricing')).toEqual({
      path: 'plans-config/:name',
      requestMethod: RequestMethod.PATCH,
    });
    expect(routeMetadata('stripeSyncCheck')).toEqual({
      path: 'stripe/sync-check',
      requestMethod: RequestMethod.GET,
    });
  });

  it('delegates read models without changing query semantics', async () => {
    finance.overview.mockResolvedValue({ margin: 42 });
    finance.listCosts.mockResolvedValue([{ id: 'cost-1' }]);
    finance.listPlans.mockResolvedValue([{ name: 'pro' }]);
    stripeSync.check.mockResolvedValue({ summary: { ok: 8 } });

    await expect(controller.financeOverview()).resolves.toEqual({ margin: 42 });
    await expect(controller.listCosts('true')).resolves.toEqual([{ id: 'cost-1' }]);
    await controller.listCosts('false');
    await expect(controller.listPlansConfig()).resolves.toEqual([{ name: 'pro' }]);
    await expect(controller.stripeSyncCheck()).resolves.toEqual({ summary: { ok: 8 } });

    expect(finance.listCosts).toHaveBeenNthCalledWith(1, true);
    expect(finance.listCosts).toHaveBeenNthCalledWith(2, false);
  });

  it('creates a cost and records the same audit contract', async () => {
    const input = {
      name: 'Redis',
      category: 'infra',
      recurrence: 'monthly',
      monthlyCostCents: 1000,
    };
    const cost = { id: 'cost-1', ...input };
    finance.createCost.mockResolvedValue(cost);

    await expect(controller.createCost(input, { user: { userId: 'admin-1' } })).resolves.toBe(cost);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'finance.cost_create',
      entityType: 'platform_cost',
      entityId: 'cost-1',
      after: cost,
    });
  });

  it('updates and deletes costs with actor auditability', async () => {
    const cost = { id: 'cost-1', active: false };
    finance.updateCost.mockResolvedValue(cost);
    finance.deleteCost.mockResolvedValue({ ok: true });

    await controller.updateCost('cost-1', { active: false }, { user: { userId: 'admin-1' } });
    await controller.deleteCost('cost-1', { user: { userId: 'admin-1' } });

    expect(audit.record).toHaveBeenNthCalledWith(1, {
      actorUserId: 'admin-1',
      action: 'finance.cost_update',
      entityType: 'platform_cost',
      entityId: 'cost-1',
      after: cost,
    });
    expect(audit.record).toHaveBeenNthCalledWith(2, {
      actorUserId: 'admin-1',
      action: 'finance.cost_delete',
      entityType: 'platform_cost',
      entityId: 'cost-1',
    });
  });

  it('keeps seed overwrite parsing and audit metadata stable', async () => {
    const summary = { created: 1, updated: 0, skipped: 0, items: [] };
    finance.seedDefaultCosts.mockResolvedValue(summary);

    await controller.seedDefaultCosts('true', { user: { userId: 'admin-1' } });

    expect(finance.seedDefaultCosts).toHaveBeenCalledWith(true);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'finance.cost_seed',
      entityType: 'platform_cost',
      metadata: { overwrite: true, summary },
    });
  });

  it('updates plan pricing with the historical audit payload', async () => {
    const plan = { id: 'plan-1', name: 'pro', price: 99 };
    finance.updatePlanPricing.mockResolvedValue(plan);

    await expect(
      controller.updatePlanPricing('pro', { price: '99' }, { user: { userId: 'admin-1' } }),
    ).resolves.toBe(plan);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'plan.pricing_update',
      entityType: 'plan',
      entityId: 'plan-1',
      after: plan,
      metadata: { name: 'pro' },
    });
  });
});
