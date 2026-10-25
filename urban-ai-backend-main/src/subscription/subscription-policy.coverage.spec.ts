import * as fs from 'fs';
import * as path from 'path';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { CONTROLLER_POLICIES, ResolvedPolicy, resolveRoutePolicy } from './subscription-policy';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionModule } from './subscription.module';

// Dependências ESM-only puxadas pelos services dos controllers; aqui só importa a metadata.
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('@turf/turf', () => ({}));

/**
 * Guarda de regressão da política de assinatura: TODA rota HTTP precisa estar
 * classificada como paga, livre ou gated por papel (admin/support). Um controller ou
 * rota nova sem classificação reprova aqui — evita voltar ao estado "o paywall só
 * existe no front".
 */
const SRC = path.resolve(__dirname, '..');
const reflector = new Reflector();

function controllerFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : controllerFiles(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });
}

type Route = { id: string; controller: string; handler: string; policy: ResolvedPolicy };

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const file of controllerFiles(SRC)) {
    const mod = require(file);
    for (const exported of Object.values(mod) as any[]) {
      if (typeof exported !== 'function' || Reflect.getMetadata(PATH_METADATA, exported) === undefined) continue;
      for (const name of Object.getOwnPropertyNames(exported.prototype)) {
        const handler = exported.prototype[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        routes.push({
          id: `${exported.name}.${name}`,
          controller: exported.name,
          handler: name,
          policy: resolveRoutePolicy(reflector, exported, handler),
        });
      }
    }
  }
  return routes;
}

describe('cobertura da política de assinatura nas rotas', () => {
  const routes = collectRoutes();
  const byId = new Map(routes.map((route) => [route.id, route]));
  const policyOf = (id: string) => byId.get(id)?.policy;

  it('enumera as rotas (sanidade da reflexão)', () => {
    expect(routes.length).toBeGreaterThan(150);
    expect(byId.has('PortfolioController.bulkAction')).toBe(true);
  });

  it('nenhuma rota está sem classificação', () => {
    expect(routes.filter((route) => route.policy === 'unclassified').map((route) => route.id)).toEqual([]);
  });

  it('o mapa central não referencia controllers/rotas que não existem mais', () => {
    const controllers = new Set(routes.map((route) => route.controller));
    const stale: string[] = [];
    for (const [controller, entry] of Object.entries(CONTROLLER_POLICIES)) {
      if (!controllers.has(controller)) stale.push(controller);
      for (const handler of Object.keys(entry.routes ?? {})) {
        if (!byId.has(`${controller}.${handler}`)) stale.push(`${controller}.${handler}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('rotas que entregam o valor pago exigem assinatura', () => {
    const mustBePaid = [
      // recomendações / aceite / aplicação
      'SugestionController.alterarAceito',
      'SugestionController.registrarPrecoAplicado',
      'SugestionController.registrarResultado',
      // processamento de análises (RapidAPI/HERE/scraping)
      'ProcessoController.criarAcao',
      'MapsController.processarAnalisesByProperty',
      // radar de eventos do anfitrião, inteligência de mercado, portfólio, ask, ritmo
      'HostEventsController.radar',
      'HostEventsController.catalog',
      'HostEventsController.heatmap',
      'HostEventsController.simulatePricing',
      'PropertiesPanelController.marketIntel',
      'PropertiesPanelController.savePricingRules',
      'PropertiesPanelController.getPricingRules',
      'PortfolioController.opportunities',
      'PortfolioController.bulkAction',
      'PaceController.portfolio',
      'AskController.question',
      // Stays (aplica preço no PMS)
      'StaysController.pushPrice',
      'StaysController.connect',
      'StaysController.listListings',
      'StaysController.syncListings',
      'StaysController.previewPrice',
      'StaysController.rollback',
      'StaysController.linkProperty',
      'StaysController.unlinkProperty',
      'StaysController.matchSuggestions',
      'StaysController.recommendation',
      'StaysController.priceUpdates',
      'StaysController.linkableProperties',
      // ROI / dashboard
      'DashboardController.myRoi',
      'DashboardController.getDashboard',
      'EventoController.getEvents',
      'EventoController.getAll',
      // propriedades: eventos analisados, ajuste de preço, alertas, ocupação
      'PropriedadeController.getEventos',
      'PropriedadeController.getEventosAcompanhando',
      'PropriedadeController.getEventosForMaps',
      'PropriedadeController.calcularAjuste',
      'PropriedadeController.createAlertAiibnb',
      'PropriedadeController.getAlertById',
      'PropriedadeController.upsertManualOccupancy',
      'ConnectController.getListingPrice',
    ];
    const notPaid = mustBePaid.filter((id) => policyOf(id) !== 'paid');
    expect(notPaid).toEqual([]);
  });

  it('rotas de identidade, LGPD, cobrança e onboarding pré-pagamento ficam livres', () => {
    const mustBeFree = [
      // auth / perfil / LGPD
      'AuthController.register',
      'AuthController.login',
      'AuthController.googleLogin',
      'AuthController.refresh',
      'AuthController.logout',
      'AuthController.me',
      'AuthController.exportMyData',
      'AuthController.deleteOwnAccount',
      'AuthController.getProfileById',
      'AuthController.updateProfileById',
      // planos / checkout / portal / assinatura
      'PlansController.getPlans',
      'PlansController.quote',
      'PaymentsController.createCheckout',
      'PaymentsController.createBillingPortalSession',
      'PaymentsController.getSubscriptions',
      'PaymentsController.getListingsQuota',
      'PaymentsController.getMyPayments',
      'PaymentsController.cancelSubscription',
      'PaymentsController.handleWebhook',
      // público / institucional
      'AppController.publicConfig',
      'HealthController.getHealth',
      'HealthController.getLive',
      'WaitlistController.signup',
      'WaitlistController.validateInvite',
      'UnsubscribeController.unsubscribe',
      'ContactSubmissionsController.create',
      'CommunicationPreferencesController.getMine',
      'EmailController.forgotPassword',
      'EmailController.confirmarEmail',
      'UserController.hasMyAddress',
      'PushController.upsertSubscription',
      'NotificationController.findAllByUser',
      // Stays: revogar credencial e ler o próprio estado nunca ficam atrás do paywall
      'StaysController.disconnect',
      'StaysController.account',
      'StaysController.capabilities',
      // onboarding passos 1-4 (importar Airbnb, cadastrar imóveis, estratégia) antes da cobrança
      'PropriedadeController.getPropertyHostId',
      'PropriedadeController.getPropertyQuickInfo',
      'PropriedadeController.getPrefetch',
      'PropriedadeController.getBasicInfo',
      'PropriedadeController.getPropertiesForDropdown',
      'PropriedadeController.getAddressesByUser',
      'PropriedadeController.findOne',
      'PropriedadeController.deleteAddressAndList',
      'PropriedadeController.updateIdentity',
      'PropriedadeController.updatePricingInputs',
      'ConnectController.resolve',
      'ConnectController.registerProperties',
      'ConnectController.createMultipleAddresses',
      'ConnectController.getAddressByCep',
      'ConnectController.getUserAddresses',
      'ConnectController.userListings',
    ];
    const notFree = mustBeFree.filter((id) => policyOf(id) !== 'free');
    expect(notFree).toEqual([]);
  });

  it('rotas administrativas (@Roles) ficam com o RolesGuard, nunca viram 402', () => {
    const adminRoutes = routes.filter((route) =>
      /^(Admin|Coverage|Communications|Cron|Mailer|Process)/.test(route.controller) &&
      route.controller !== 'ProcessoController',
    );
    expect(adminRoutes.length).toBeGreaterThan(40);
    expect(adminRoutes.filter((route) => route.policy !== 'role').map((route) => route.id)).toEqual([]);
  });

  it('o SubscriptionGuard está registrado globalmente (APP_GUARD) e o módulo entra no AppModule', () => {
    const providers: any[] = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SubscriptionModule);
    expect(providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ provide: APP_GUARD, useClass: SubscriptionGuard })]),
    );
    const imports: any[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    expect(imports).toContain(SubscriptionModule);
  });
});
