# Veo AI Studio Build Status

Last updated: 2026-09-03

## Active milestone
Foundation hardening: phases 1-5 of `docs/PRODUCT_ROADMAP.md`.

## Completed in this build session
- Set Node.js 22 via `.nvmrc` and `package.json` engines.
- Upgraded repository Next.js target from vulnerable 15.3.5 to 15.5.24.
- Pinned production dependencies instead of open semver ranges.
- Added official `@supabase/ssr` and `@supabase/supabase-js` dependencies.
- Added `lib/supabase/client.ts` browser client.
- Added `lib/supabase/server.ts` server client using Next.js cookies.
- Added `lib/supabase/admin.ts` server-only service-role client.
- Added `middleware.ts` for Supabase session refresh and protection of authenticated application routes.
- Added reproducible migration `supabase/migrations/202609030001_paid_saas_core.sql`.
- Migration fixes generation-to-project ownership with a composite foreign key.
- Migration expands generation lifecycle states for reservation/submission/upload stages.
- Migration defines plans, subscriptions, payments, credit balances, credit ledger, assets, favorites, Paystack webhook events, generation costs, and audit events.
- Added `202609030002_credit_engine.sql` with transactional, idempotent credit grant/reserve/capture/release functions restricted to `service_role`.
- Added `202609030003_subscription_billing_identity.sql` for Paystack reconciliation fields and indexes.
- Added production auth server actions for sign in, sign up, password reset request, password update, and sign out.
- Added `/login`, `/signup`, `/forgot-password`, and `/update-password` screens.
- Added `/auth/confirm` email verification callback using Supabase OTP verification.
- Replaced the dashboard's legacy localStorage AuthGate flow with server-side cookie authentication.
- Project listing and project creation on `/dashboard` now use the authenticated server Supabase client.
- Added server-only Paystack API client with transaction initialization, verification, HMAC-SHA512 webhook verification, and timing-safe signature comparison.
- Added `/api/billing/checkout` to initialize a Paystack plan subscription from the authenticated backend.
- Added idempotent payment fulfillment that verifies amount/currency against the local plan before subscription activation or credit grant.
- Added `/api/billing/callback` that verifies the Paystack transaction server-side before redirecting to billing status.
- Added `/api/webhooks/paystack` with webhook replay protection, charge fulfillment, subscription reconciliation, cancellation handling, and failed-invoice handling.
- Added `/billing` UI showing active plans, subscription status, available/reserved credits, and secure checkout controls.
- Added `.env.example` documenting public and server-only environment boundaries.
- Added GitHub Actions CI using Node 22 with install, lint, and production build checks.

## Important current limitations
1. The live Supabase migrations have NOT been applied yet. The Supabase write connector is unavailable, so live schema/RLS/transactional functions could not be changed or verified in this session.
2. Paystack checkout cannot be exercised until a Paystack test secret and test plan codes are configured in the deployment environment and corresponding `plans` rows are activated.
3. The existing Vercel production site is still the earlier direct-deployed shell. The GitHub branch is ahead of production and must pass CI before preview/promotion.
4. `package-lock.json` still needs regeneration for the pinned dependency set. The local runtime cannot reach npm reliably, so CI currently uses `npm install` rather than `npm ci` until the lockfile is refreshed.

## Environment requirements
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `GEMINI_API_KEY` (later, when real Veo generation is enabled)

Future R2 variables are documented in `.env.example` but are not active yet.

## Next actions
1. Apply all committed Supabase migrations and run security advisors.
2. Verify composite ownership constraints, RLS, and credit functions with isolated test users.
3. Inspect/fix GitHub CI results until lint/build pass.
4. Regenerate and commit `package-lock.json` for the pinned dependency set.
5. Configure Paystack test plans and test secret, then test signup -> plan -> checkout -> webhook -> subscription -> credits end to end.
6. Add cancellation/management UI and renewal-period timestamps after receiving real Paystack test webhook shapes.
7. Connect the real GitHub repository to Vercel preview deployment and verify auth/billing there before production promotion.
8. Begin Phase 6 UI shell only after the foundation acceptance checks pass.

## Production rule
Do not enable real Veo generation or live Paystack billing until authentication, subscription entitlement, credit accounting, webhook idempotency, and spend limits have all passed their acceptance tests.
