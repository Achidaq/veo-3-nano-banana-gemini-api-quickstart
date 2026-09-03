# Veo AI Studio Build Status

Last updated: 2026-09-03

## Active milestone
Foundation hardening: phases 1-5 of `docs/PRODUCT_ROADMAP.md`.

## Verified completed work
- Node.js 22 runtime target via `.nvmrc` and `package.json` engines.
- Next.js upgraded from 15.3.5 to patched Maintenance LTS 15.5.24.
- Production dependencies pinned; vulnerable runtime transitive packages overridden to patched releases.
- `@google/genai` upgraded from stale 1.8.0 to 2.21.0.
- Official Supabase SSR/browser clients added with server cookie sessions.
- Server-only Supabase service-role client added.
- Protected application routes and session-refresh middleware added.
- Production auth screens/actions added: signup, login, logout, email confirmation, forgot/reset password.
- Dashboard migrated away from localStorage AuthGate to server-authenticated project access.
- Paid SaaS schema migration committed with plans, subscriptions, payments, credit balances/ledger, assets, favorites, webhook events, generation costs, audit events, RLS, and project/generation ownership integrity.
- Transactional credit engine migration committed with idempotent grant/reserve/capture/release RPCs restricted to service role.
- Paystack reconciliation migration committed.
- Server-only Paystack client added with checkout initialization, transaction verification, HMAC-SHA512 webhook verification, and timing-safe signature comparison.
- Paystack checkout, callback, idempotent fulfillment, webhook replay protection, subscription activation, cancellation, and failed-payment handling added.
- Billing UI added with plan, subscription, available-credit, and reserved-credit state.
- Veo provider migrated from retired Veo 3.0 IDs to Veo 3.1 Lite/Fast/Standard IDs.
- Server-side Veo cost/credit quotation added with model, resolution, and duration validation.
- Veo generation endpoint now requires authentication, active subscription, concurrency allowance, sufficient credits, and the explicit `ENABLE_REAL_VEO_GENERATION=true` feature flag.
- Credits are reserved atomically before a Google request, captured on successful completed output, and released on provider failure.
- Veo polling is ownership-scoped to the authenticated user.
- Inherited Veo download SSRF/credential-leak shape fixed by requiring authentication and restricting upstream downloads to the approved Google API hostname.
- Image-generation/edit routes now require authentication + active subscription and remain disabled unless `ENABLE_REAL_IMAGE_GENERATION=true` until image-credit accounting is finalized.
- Image edit upload limits and MIME allowlisting added.
- GitHub Actions CI deduplicated and modernized on Node 22.
- CI production dependency audit passes.
- CI lint passes.
- CI full Next.js production build passes.
- PR #1 is now mergeable.

## Important current limitations
1. The live Supabase migrations have NOT been applied yet. The Supabase write connector is unavailable, so live schema/RLS/credit RPCs have not been changed or verified.
2. Paystack checkout cannot be exercised until a Paystack test secret and real Paystack test plan codes are configured and matching local plan rows are activated.
3. The existing Vercel production site is still the earlier direct-deployed shell. The verified GitHub branch has not been promoted.
4. CI regenerated a current `package-lock.json` and exported it as an artifact, but the connector cannot directly replace the repository lockfile from that artifact. The checked-in lockfile therefore remains stale even though CI installation/build is verified.
5. The legacy `app/page.tsx` still resets video mode to its old model string. The backend safely normalizes that legacy selection to Veo 3.1 Lite, but the full model/resolution/duration/credit-cost UI will be rebuilt in Phase 6.
6. Real provider flags remain off by design. No paid Google calls should be possible from this branch until the live entitlement database is ready.

## Required environment variables
Public:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `GEMINI_API_KEY`
- `ENABLE_REAL_VEO_GENERATION` (default off)
- `ENABLE_REAL_IMAGE_GENERATION` (default off)

Future R2 variables are documented in `.env.example` but are not active yet.

## Next actions
1. Restore Supabase write access, apply all committed migrations, and run security advisors.
2. Verify composite project/generation ownership, RLS isolation, and all four credit RPCs with isolated test users.
3. Configure Paystack test-mode secret + monthly plan codes and seed/activate the matching local plans only after final GHS prices are approved.
4. Run signup -> verified email -> pricing -> Paystack test checkout -> webhook -> active subscription -> exactly-once credit grant end to end.
5. Configure Vercel preview environment variables with real Supabase public/server credentials but provider feature flags OFF.
6. Deploy the verified GitHub branch to a protected preview and test auth/billing there before production promotion.
7. Replace the legacy generator composer in Phase 6 with the approved screenshot-level UI including Veo 3.1 model, duration, resolution, and visible credit quote controls.
8. Add Cloudflare R2 before storing production-generated MP4s.

## Production rule
Do not enable real Veo/image generation or live Paystack billing until authentication, subscription entitlement, credit accounting, webhook idempotency, RLS isolation, and spend controls have passed their acceptance tests.
