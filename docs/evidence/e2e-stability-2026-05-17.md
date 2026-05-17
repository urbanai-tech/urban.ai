# E2E stability evidence - 2026-05-17

Generated during the automated hardening pass on 2026-05-17.

## Stable CI Subset

The mocked local CI subset remains the trusted gate:

- `onboarding-airbnb-import.spec.ts`
- `dashboard-recommendations.spec.ts`
- `email-confirmation.spec.ts`
- `f8-waitlist-to-login.spec.ts`
- `login-post-login.spec.ts`
- `logout.spec.ts`
- `my-plan-billing.spec.ts`
- `plans-checkout-readiness.spec.ts`
- `properties-pricing.spec.ts`
- `reset-password.spec.ts`
- `prelaunch-waitlist-analytics.spec.ts`
- `admin-quality-occupancy.spec.ts`
- `stays-integrations.spec.ts`

Latest local run of the expanded subset: `22 passed`, `1 skipped`.

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

Result after selector/mock repairs:

- Passing: `dashboard-recommendations`, `email-confirmation`,
  `f8-waitlist-to-login`, `login-post-login`, `logout`,
  `plans-checkout-readiness`, `properties-pricing`, and `stays-integrations`.
- Skipped by design: Stripe publishable-key negative smoke when the test key is
  configured.

Promoted into CI:

- `login-post-login.spec.ts`: consent setup and async state assertion were
  repaired, and the login success path now routes immediately to `/post-login`.

## Policy

Only green tests should be promoted to required CI gates. The CI now runs the
expanded green subset, including the repaired login to post-login route.
