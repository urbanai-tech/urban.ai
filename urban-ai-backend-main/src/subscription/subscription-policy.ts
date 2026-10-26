import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';

/**
 * Política de assinatura por rota.
 *
 *  - 'paid'  : exige direito de uso (assinatura ativa/trial/alpha/admin) -> senão 402 SUBSCRIPTION_REQUIRED;
 *  - 'free'  : acessível a qualquer usuário (cadastrado ou não);
 *  - 'role'  : rota com @Roles(...) (admin/support) — quem decide é o RolesGuard.
 *
 * Duas formas de declarar, em ordem de precedência:
 *  1. decorators `@RequiresSubscription()` / `@SubscriptionFree()` no handler ou na classe
 *     (para código novo);
 *  2. mapa central `CONTROLLER_POLICIES` (por NOME DE CLASSE + nome do método). Existe para
 *     cobrir controllers sem editá-los — a política fica toda num arquivo só, auditável.
 *
 * Rota sem classificação não é bloqueada em runtime, mas
 * `subscription-policy.coverage.spec.ts` reprova o CI até ela ser classificada aqui.
 */
export type RoutePolicy = 'paid' | 'free';
export type ResolvedPolicy = RoutePolicy | 'role' | 'unclassified';

export const SUBSCRIPTION_POLICY_KEY = 'urbanai:subscription-policy';

export const RequiresSubscription = () => SetMetadata(SUBSCRIPTION_POLICY_KEY, 'paid' satisfies RoutePolicy);
export const SubscriptionFree = () => SetMetadata(SUBSCRIPTION_POLICY_KEY, 'free' satisfies RoutePolicy);

interface ControllerPolicy {
  /** Política padrão dos handlers do controller. */
  default: RoutePolicy;
  /** Exceções por nome de método (o inverso do default). */
  routes?: Record<string, RoutePolicy>;
}

/**
 * ONBOARDING (front, passos 1-4, antes do passo 5 = cobrança) precisa de:
 *  Airbnb import (propriedades/hostId, quick-info, airbnb/room-info, airbnb/room-basic-info,
 *  connect/resolve), cadastro de imóveis (connect/register, connect/addresses, connect/cep,
 *  propriedades/dropdown/list, user/, :id, address/:id, :id/identity, :id/pricing-inputs),
 *  estratégia (PUT auth/profile) e billing (payments/*, plans/*). Tudo isso é 'free'.
 *
 * O que ENTREGA o valor pago (recomendações, radar de eventos, inteligência de mercado,
 * portfólio, Ask, Stays, regras de preço, ROI, aceitar/aplicar sugestão e processamento de
 * análises) é 'paid'. POST /processos é 'paid': o front trata o 402 do onboarding como
 * "análise inicia assim que o plano for ativado" (os crons só processam quem tem direito).
 */
export const CONTROLLER_POLICIES: Record<string, ControllerPolicy> = {
  // ── livres: identidade, LGPD, cobrança, institucional ─────────────────────
  AppController: { default: 'free' }, // public-config
  HealthController: { default: 'free' },
  AuthController: { default: 'free' }, // login/register/profile/me/export/delete (LGPD)
  PaymentsController: { default: 'free' }, // checkout, portal, quota, getSubscription, webhook
  PlansController: { default: 'free' },
  WaitlistController: { default: 'free' },
  UnsubscribeController: { default: 'free' },
  ContactSubmissionsController: { default: 'free' },
  CommunicationPreferencesController: { default: 'free' },
  EmailController: { default: 'free' }, // confirmação de e-mail / reset de senha
  UserController: { default: 'free' }, // users/me/has-address (post-login)
  PushController: { default: 'free' }, // inscrição de push
  NotificationController: { default: 'free' }, // ler/marcar notificações já existentes
  EventsIngestController: { default: 'free' }, // chave de máquina / admin, sem usuário final

  // ── onboarding pré-pagamento: livre, exceto cotação de preço ───────────────
  ConnectController: { default: 'free', routes: { getListingPrice: 'paid' } },
  PropriedadeController: {
    default: 'paid',
    routes: {
      getPropertyHostId: 'free',
      getPropertyQuickInfo: 'free',
      getPrefetch: 'free',
      getBasicInfo: 'free',
      getPropertiesForDropdown: 'free',
      getAddressesByUser: 'free',
      findOne: 'free',
      deleteAddressAndList: 'free',
      updateIdentity: 'free',
      updatePricingInputs: 'free',
      getPricingInputHistory: 'free',
      getBaseline: 'free',
      updateHostBaseline: 'free',
    },
  },

  // ── valor pago ────────────────────────────────────────────────────────────
  DashboardController: { default: 'paid' }, // receita/lucro projetado, ROI
  EventoController: { default: 'paid' }, // event, event/all
  HostEventsController: { default: 'paid' }, // radar, catálogo, heatmap, simulação
  PaceController: { default: 'paid' },
  PortfolioController: { default: 'paid' },
  PropertiesPanelController: { default: 'paid' }, // pace, regras de preço, market-intel
  AskController: { default: 'paid' },
  // Stays aplica preço no PMS: pago. Livre só o que nunca entrega valor e não pode
  // ficar refém do paywall: ver o estado salvo, saber se a escrita está ligada e
  // DESCONECTAR (revogar a credencial guardada — LGPD).
  StaysController: {
    default: 'paid',
    routes: { account: 'free', capabilities: 'free', disconnect: 'free' },
  },
  SugestionController: { default: 'paid' }, // aceitar/aplicar/resultado
  MapsController: { default: 'paid' }, // processar-analises-by-property
  ProcessoController: { default: 'paid' }, // POST /processos
};

export function resolveRoutePolicy(
  reflector: Reflector,
  classRef: { name: string },
  handlerRef: { name: string },
): ResolvedPolicy {
  // 1) rota gated por papel: deixa para o RolesGuard (admin/support)
  const roles =
    reflector.get<string[]>(ROLES_KEY, handlerRef as never) ??
    reflector.get<string[]>(ROLES_KEY, classRef as never);
  if (Array.isArray(roles) && roles.length > 0) return 'role';

  // 2) decorator explícito (handler > classe)
  const explicit =
    reflector.get<RoutePolicy>(SUBSCRIPTION_POLICY_KEY, handlerRef as never) ??
    reflector.get<RoutePolicy>(SUBSCRIPTION_POLICY_KEY, classRef as never);
  if (explicit === 'paid' || explicit === 'free') return explicit;

  // 3) mapa central
  const entry = CONTROLLER_POLICIES[classRef.name];
  if (!entry) return 'unclassified';
  return entry.routes?.[handlerRef.name] ?? entry.default;
}
