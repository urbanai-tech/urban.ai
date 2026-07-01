# Release Evidence

This directory can store generated Markdown evidence for release handoffs.

## Current handoff package

For a new developer, start at `docs/handoff/README.md`. Evidence files in this directory prove specific runs; they are not the main onboarding path.

Never store secret values in evidence. Use presence/absence reports and provider access instead.

## Enterprise auditability controls

Use `docs/evidence/enterprise-auditabilidade-controles-2026-05-22.md` as the control log for:

- Stays auto-apply envs: `STAYS_AUTO_APPLY_ENABLED`, `STAYS_AUTO_APPLY_DRY_RUN`, `STAYS_AUTO_APPLY_USER_ALLOWLIST`, `STAYS_AUTO_APPLY_LISTING_ALLOWLIST`.
- AskUrban entitlement server-side.
- Error state vs empty state.
- Persistent jobs tracking.
- Validation criteria before marking a control as done.

Generated evidence files for the 2026-05-22 enterprise auditability pass:

- `enterprise-live-gate-dry-run-2026-05-22.md`: planned live-gate checks without credentials.
- `restore-drill-dry-run-2026-05-22.md`: planned restore verification checks without a restored DB URL.
- `enterprise-access-readiness-2026-05-22.md`: safe presence-only report for required real environment variables.
- `release-evidence-2026-05-22.md`: local git/workflow metadata evidence.

Do not mark a control as approved only because docs or code changed. Each approval must include date, environment, git SHA/branch when available, command or manual procedure, observed result, and residual risk.

## SEO/SGO/GEO cases

Use `docs/evidence/seo-case-evidence-framework-2026-05-19.md` before publishing any case, benchmark, ROI, uplift, occupancy, revenue, or comparison claim on public SEO/GEO pages.

Until source, period, sample, consent, and review are complete, public copy must keep the case as `em validacao` and avoid quantitative claims.

Generate a preview without writing a file:

```sh
node scripts/release-evidence.js --dry-run
```

Write a release evidence file:

```sh
node scripts/release-evidence.js --output docs/evidence/release-evidence.md
```

The generator collects local git SHA, branch, remotes, working tree status, and optional GitHub CLI metadata when `gh` is available. It does not read environment variables or file contents, and it redacts remote credentials plus common token formats before writing output.
