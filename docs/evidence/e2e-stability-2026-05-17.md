# E2E stability evidence - 2026-05-17

Generated during the automated hardening pass on 2026-05-17.

## Stable CI Subset

The mocked local CI subset remains the trusted gate:

- `onboarding-airbnb-import.spec.ts`
- `my-plan-billing.spec.ts`
- `reset-password.spec.ts`
- `prelaunch-waitlist-analytics.spec.ts`
- `admin-quality-occupancy.spec.ts`

Last local run of this subset: `10 passed`.

## Extended E2E Investigation

An extended local run against `http://127.0.0.1:3000` included:

- `dashboard-recommendations.spec.ts`
- `email-confirmation.spec.ts`
- `f8-waitlist-to-login.spec.ts`
- `login-post-login.spec.ts`
- `logout.spec.ts`
- `plans-checkout-readiness.spec.ts`
- `properties-pricing.spec.ts`
- `stays-integrations.spec.ts`

Result:

- Passed: `5`
- Skipped: `1`
- Failed: `7`

Passing in the extended run:

- `dashboard-recommendations.spec.ts`: `3/3`
- `email-confirmation.spec.ts`: `1/1`
- `plans-checkout-readiness.spec.ts`: first test passed; Stripe-key test skipped by design

Still failing and not promoted into CI:

- `f8-waitlist-to-login.spec.ts`: navigation timed out on `/waitlist/aceitar`
- `login-post-login.spec.ts`: post-login navigation did not reach `/dashboard`
- `logout.spec.ts`: local Next dev overlay intercepted the `Sair` click
- `plans-checkout-readiness.spec.ts`: custom price case timed out on `/plans`
- `properties-pricing.spec.ts`: property list did not render expected fixture
- `stays-integrations.spec.ts`: expected connected status did not render

## Policy

Only green tests should be promoted to required CI gates. The current CI keeps the
validated subset while the extended specs remain under repair.

