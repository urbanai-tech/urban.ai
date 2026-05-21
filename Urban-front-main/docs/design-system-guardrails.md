# Urban AI Design System Guardrails

## Current Standard

- Authenticated host UI uses `src/app/componentes/ui/*` and `urban-app` tokens.
- Admin UI uses `src/app/admin/_components/*` and `urban-admin` tokens.
- Public pages use the editorial `urban-manifesto` / `urban-public-*` layer.
- Icons use `lucide-react` for screen-level icons and `componentes/ui/Icons.tsx` for shared app primitives.
- Toasts use `AppToastProvider`, `useAppToast`, or `useToastCompat`.
- Shared TSX style primitives live in `src/app/componentes/ui/styles.ts`.

## Do Not Add

- Chakra UI, Ant Design, Headless UI, FontAwesome, React Icons, Heroicons, or React Toastify.
- Direct Emotion dependencies. Emotion can remain only as a transitive dependency of `react-select`.
- New Tailwind utility islands for product UI. Prefer UI components, tokens, or scoped CSS classes.

## Where To Change Design

- Component behavior/variants: edit the component in `src/app/componentes/ui`.
- Shared TSX primitives: edit `src/app/componentes/ui/styles.ts`.
- App/admin/shared CSS tokens: edit `src/app/componentes/ui/design-tokens.css`.
- Public page layout helpers: edit the scoped `urban-public-*` blocks in `src/app/globals.css`.

## Audit

Run this before opening UI work:

```bash
npm run design:audit
```

The audit fails on forbidden packages/imports and warns on remaining Tailwind-like classes while the last cleanup items are being retired.
