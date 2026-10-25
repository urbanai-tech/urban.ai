// Evita carregar a cadeia pesada (TypeORM/ESM) dos services reais: o teste só exercita o controller.
jest.mock('./dashboard.service', () => ({ DashboardService: class {} }));
jest.mock('src/roi/roi.service', () => ({ RoiService: class {} }));
jest.mock('src/auth/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));

import { DashboardController } from './dashboard.controller';

describe('DashboardController.getDashboard', () => {
  it('não loga quebras de linha vindas do query param (log injection)', async () => {
    const dashboardService = { getDashBoard: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new DashboardController(dashboardService as any, {} as any);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const evil = 'abc\n[ERROR] admin comprometido\r';
    const result = await controller.getDashboard({ user: { userId: 'u1' } }, evil);

    const logged = spy.mock.calls.flat().join(' ');
    spy.mockRestore();
    expect(logged).not.toMatch(/[\r\n]/);
    expect(logged).toContain('abc');
    // o valor original segue intacto para o service
    expect(dashboardService.getDashBoard).toHaveBeenCalledWith('u1', evil);
    expect(result).toEqual({ ok: true });
  });
});
