import { GUARDS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SUBSCRIPTION_POLICY_KEY } from '../subscription/subscription-policy';
import { OwnerReportPublicController } from './owner-report-public.controller';
import { PropertyOwnersController } from './property-owners.controller';

type ControllerClass = abstract new (...args: never[]) => unknown;

const routesOf = (controller: ControllerClass) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = (controller.prototype as any)[name];
      return {
        name,
        path: Reflect.getMetadata(PATH_METADATA, handler) as string,
        method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
        throttled: Reflect.getMetadata('THROTTLER:LIMITmedium', handler) !== undefined,
      };
    });

describe('controllers do relatório do proprietário', () => {
  it('rotas do anfitrião exigem login (JwtAuthGuard) e plano com direito de uso', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PropertyOwnersController)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(SUBSCRIPTION_POLICY_KEY, PropertyOwnersController)).toBe('paid');
    expect(Reflect.getMetadata(PATH_METADATA, PropertyOwnersController)).toBe('property-owners');
  });

  it('rotas públicas não exigem login nem plano e todas têm limite por IP', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OwnerReportPublicController)).toBeUndefined();
    expect(Reflect.getMetadata(SUBSCRIPTION_POLICY_KEY, OwnerReportPublicController)).toBe('free');
    const routes = routesOf(OwnerReportPublicController);
    expect(routes.map((r) => `${r.method}:${r.path}`).sort()).toEqual(
      [`${RequestMethod.GET}:public/:token`, `${RequestMethod.GET}:unsubscribe`, `${RequestMethod.POST}:unsubscribe`].sort(),
    );
    for (const route of routes) expect(route.throttled).toBe(true);
  });

  it('a rota pública de leitura é só GET (somente leitura) e nunca cacheável nem indexável', () => {
    const handler = OwnerReportPublicController.prototype.read;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    const headers = Reflect.getMetadata('__headers__', handler) as Array<{ name: string; value: string }>;
    const byName = Object.fromEntries(headers.map((h) => [h.name, h.value]));
    expect(byName['Cache-Control']).toBe('no-store');
    expect(byName['X-Robots-Tag']).toMatch(/noindex/);
    expect(byName['Referrer-Policy']).toBe('no-referrer');
  });
});
