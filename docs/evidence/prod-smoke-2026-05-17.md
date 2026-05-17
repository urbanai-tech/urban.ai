# Production smoke evidence - 2026-05-17

Generated during the production smoke pass on 2026-05-17.

## Target

- App: `https://app.myurbanai.com`
- API: `https://urbanai-production-85fd.up.railway.app`

## Results

- API `/health`: `200`, `status=ok`, `checks.db=ok`
- API `/health/live`: `200`
- App `/`: `200`
- App `/robots.txt`: `200`
- Public Playwright smoke: `5 passed`, `2 skipped`
- Public release gate: `14 passed`

## Authenticated Smoke

The authenticated smoke did not complete because the backend returned `401` on
`POST /auth/login` for the provided tester account.

Validation performed without printing secrets or tokens:

- frontend login flow reached `POST /auth/login`
- direct API login using the frontend SHA-256 password contract returned `401`
- direct API login using the legacy plaintext contract also returned `401`

## Follow-up

Authenticated product audit, dashboard smoke, admin smoke, Stripe smoke,
recommendation smoke, and AskUrban smoke remain blocked until a valid tester
credential or reset password is available for the target environment.
