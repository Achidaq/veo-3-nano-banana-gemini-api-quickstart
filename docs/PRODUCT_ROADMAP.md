# Veo AI Studio — Canonical Product Roadmap

Last updated: 2026-09-02
Status: Living document
Purpose: This is the canonical roadmap for taking Veo AI Studio from the current deployed prototype to the production-grade paid AI video platform shown in the design mockup. Update this file whenever architecture, pricing, security, product scope, or implementation status changes.

## 1. Product goal

Build a secure, paid AI video generation SaaS with a polished UI comparable in usability and quality to modern generation tools such as Runway, Kling, and Higgsfield, without copying their branding or proprietary interfaces.

Primary launch markets: United States and Europe.

Core business model:
- No free trial.
- No free generation credits.
- Paid subscription required before real AI generation.
- Credit-metered usage rather than “unlimited generations.”
- Credits must be tied to real provider cost.
- Hard server-side entitlement, rate, concurrency, and spend controls.

## 2. Current state

Already available or started:
- Next.js application.
- Vercel deployment.
- Patched Next.js production build.
- Basic Generate workspace UI.
- Supabase project connected.
- Profiles, projects, and generations database foundation.
- Row-level security foundation.
- Authentication helpers and dashboard branch.
- Google Gemini/Veo quickstart routes in the repository.
- Generation-history foundation.

Not production-ready yet:
- Production authentication/session architecture.
- Paid-only onboarding.
- Paystack billing.
- Credit ledger and reservation system.
- Background generation worker/state machine.
- Cloudflare R2 media storage.
- Full projects/history/templates/settings UI.
- Admin dashboard.
- Abuse protection and spend protection.
- SEO/public marketing architecture.
- GDPR/privacy flows.
- Production monitoring and alerts.

## 3. Locked architectural direction

Frontend/application:
- Next.js.
- Vercel Pro for commercial production hosting.
- GitHub -> Vercel deployment flow.

Authentication/database:
- Supabase Auth.
- Supabase Postgres.
- Supabase RLS for all user-owned data.
- Move production auth toward secure SSR/cookie-based sessions rather than relying primarily on localStorage.

Billing:
- Paystack subscriptions.
- Server-side webhook verification.
- Server-side transaction verification.
- Idempotent payment processing.

AI providers:
- Google Gemini / Veo initially.
- Veo Lite/Fast as default economical models.
- Higher-cost Standard model charged at substantially higher credit usage.
- Provider abstraction later so other models can be added without rewriting billing.

Media storage:
- Cloudflare R2 for generated videos before production launch.
- Private objects.
- Short-lived signed playback/download URLs.
- Supabase remains the system of record for metadata and ownership.

Preferred object path:
users/{userId}/projects/{projectId}/generations/{generationId}/original.mp4

Optional derived assets:
- thumbnail.webp
- poster.webp
- preview.mp4
- upscaled.mp4

## 4. Core security principle

Anything sent to the browser can be inspected. Frontend secrecy is not a security control.

The browser must never be trusted to decide:
- whether a user is subscribed,
- how many credits they have,
- which model they may use,
- how much a generation costs,
- whether a payment succeeded,
- what files they may access.

Every sensitive decision is verified server-side.

Secrets must never be exposed client-side:
- GEMINI_API_KEY
- PAYSTACK_SECRET_KEY
- SUPABASE_SERVICE_ROLE_KEY
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

Public keys such as the Supabase publishable key are allowed in client code because RLS is the authorization boundary.

## 5. Subscription and credit strategy

No Free plan.

Initial plan concepts are provisional and must be validated against real usage before public launch:

Creator:
- approximately $19/month equivalent.
- around 180 credits/month.
- 1 concurrent generation.
- basic storage and retention.

Pro:
- approximately $39/month equivalent.
- around 380 credits/month.
- 2 concurrent generations.
- higher storage and priority.

Studio:
- approximately $79/month equivalent.
- around 760 credits/month.
- 3-4 concurrent generations.
- larger storage and priority.

Do not sell unlimited generation.

Credit policy:
- Tie credits to actual provider cost.
- Reserve credits before submitting a generation.
- Capture credits on successful provider acceptance/completion according to final accounting rules.
- Refund/release reserved credits when a request fails before billable provider work.
- Never allow balances to go negative.
- Use an append-only credit ledger plus a cached balance.

Credit ledger example:
+380 monthly_subscription
-16 generation
-24 generation
+16 generation_refund
+100 purchased_credit_pack

## 6. Required database model

Core tables:
- profiles
- projects
- generations
- assets
- favorites
- plans
- subscriptions
- payments
- credit_ledger
- credit_balances
- webhook_events
- generation_costs
- audit_events

Generation ownership must be enforced so a user cannot create or attach a generation to another user's project.

All exposed user-owned tables must use RLS.

## 7. Paystack requirements

Payment flow:
1. User signs up.
2. User verifies email.
3. User chooses a plan.
4. Backend initializes Paystack checkout.
5. User completes payment.
6. Paystack webhook reaches server.
7. Server verifies Paystack signature.
8. Server verifies transaction details.
9. Server checks expected amount, currency, customer, plan, and reference.
10. Server records the payment exactly once.
11. Subscription activates.
12. Monthly credits are allocated exactly once.

Never grant credits from browser callback parameters alone.

Every webhook/payment reference must be idempotent and unique.

## 8. Generation architecture

Browser flow:
Browser -> our API -> auth check -> subscription check -> credit check -> entitlement/model validation -> rate/concurrency check -> credit reservation -> generation record -> provider submission.

The client receives a generation ID, not provider credentials.

Generation state machine:
- queued
- reserved
- submitting
- processing
- uploading
- completed
- failed
- cancelled

Long-running work must not depend on the browser staying open.

The generation should survive:
- browser closing,
- mobile network changes,
- long provider processing times,
- page refreshes.

## 9. Spend and abuse protection

Per request checks:
- authenticated user,
- verified email,
- active subscription,
- account not suspended,
- sufficient credits,
- allowed model,
- allowed duration,
- allowed resolution,
- concurrency limit,
- daily limit,
- rate limit,
- request idempotency,
- upload validation,
- prompt/policy checks where required.

Global protections:
- provider daily spend ceiling,
- provider monthly spend alerts,
- emergency generation kill switch,
- suspicious usage alerts,
- IP/user rate limiting,
- bot protection for signup/login/reset/checkout/generation.

## 10. Media and retention policy

Generated media should not be stored on Vercel local filesystem.

Use Cloudflare R2 for generated video files and thumbnails.

Private by default.

Playback and download should use short-lived signed URLs.

Do not promise permanent unlimited storage.

Initial retention concept:
- Creator: 90 days.
- Pro: 180 days.
- Studio: 365 days.

Retention policy remains provisional until cost modeling is complete.

## 11. Production UI map

Public pages:
- /
- /pricing
- /ai-video-generator
- /text-to-video
- /image-to-video
- /veo-video-generator
- /templates/...
- /privacy
- /terms
- /acceptable-use

Authenticated app:
- /projects
- /generate
- /history
- /favorites
- /templates
- /assets
- /settings
- /billing
- /generations/[id]
- /projects/[id]

Admin:
- /admin
- /admin/users
- /admin/generations
- /admin/payments
- /admin/costs
- /admin/abuse

## 12. Landing page requirements

Hero:
- strong AI video value proposition.
- demo reel.
- Start Creating CTA.
- Watch Demo CTA.

Sections:
- showcase,
- models,
- text-to-video,
- image-to-video,
- use cases,
- templates,
- example outputs,
- pricing,
- FAQ,
- footer/legal.

The landing page should be fast and mostly static.
Do not load authenticated dashboard logic unnecessarily on public marketing pages.

## 13. Projects page

Features:
- project grid/list,
- search,
- sort,
- recent projects,
- thumbnails,
- generation count,
- last modified,
- rename,
- duplicate,
- archive,
- delete,
- project storage usage.

## 14. Generate page

Controls:
- model,
- prompt,
- negative prompt,
- image upload,
- aspect ratio,
- duration,
- resolution,
- provider-supported options,
- estimated credit cost,
- Generate button.

Credits consumed must be visible before submission.

Default users toward lower-cost economical models.
Do not default to the most expensive provider option.

## 15. Generation progress page

Show real stages rather than fake precision:
- Preparing
- Generating
- Processing
- Uploading
- Done

Show:
- prompt/reference thumbnail,
- model,
- credit reservation,
- status,
- elapsed time,
- cancel where technically supported.

## 16. Video details page

Show:
- video player,
- title,
- prompt,
- model,
- resolution,
- duration,
- aspect ratio,
- creation date,
- credits used,
- project.

Actions:
- download,
- favorite,
- duplicate prompt,
- regenerate,
- variation,
- delete,
- move project.

Future:
- upscale,
- extend,
- edit.

## 17. History page

Filters:
- all,
- completed,
- processing,
- failed,
- date,
- model,
- project,
- resolution,
- prompt search.

Each item:
- thumbnail,
- prompt/title,
- model,
- duration,
- credits,
- date,
- status,
- actions.

## 18. Templates page

Categories:
- cinematic,
- product,
- marketing,
- social,
- travel,
- fashion,
- real estate,
- food,
- automotive,
- fantasy,
- anime,
- corporate.

Each template stores:
- prompt structure,
- recommended model,
- aspect ratio,
- duration,
- reference expectations,
- example output.

Using a template should populate Generate, not automatically spend credits.

## 19. Settings and billing

Settings tabs:
- Profile
- Security
- Plan & Billing
- Preferences
- Notifications
- Privacy

Billing must display:
- active plan,
- subscription status,
- next billing date,
- credits used/remaining,
- payment history,
- cancel subscription,
- upgrade/downgrade rules.

## 20. Admin dashboard

Admin metrics:
- total users,
- active subscriptions,
- MRR,
- Paystack revenue,
- provider spend,
- gross margin,
- generations today,
- generation success/failure rate,
- storage usage,
- suspicious accounts,
- users by country.

Admin support tools:
- inspect user subscription,
- inspect credit ledger,
- inspect generation history,
- refund/add credits with audit record,
- suspend/unsuspend account.

Admin role must never be controlled by client-editable metadata.

## 21. Upload security

For reference uploads:
- enforce file-size limit,
- dimension limit,
- validate MIME,
- validate actual file signature/magic bytes,
- use server-controlled object names,
- ignore unsafe original filenames,
- never execute uploaded content,
- strip unnecessary metadata when practical.

## 22. SEO and USA/Europe visibility

Authenticated customer content remains private and noindex.

Public marketing pages should target real user intent:
- AI video generator,
- text-to-video,
- image-to-video,
- Veo video generator,
- AI product video generator,
- AI advertising video,
- cinematic AI video,
- social video generation.

Public demo video watch pages should use proper video metadata and structured data where appropriate.

International expansion:
- English-first launch.
- Separate localized URL paths later, e.g. /de/, /fr/, /es/, /it/, /nl/.
- hreflang for localized pages.
- Do not rely only on IP-based content switching.

## 23. Privacy / EU readiness

Before intentional EU launch:
- Privacy Policy,
- Terms,
- Acceptable Use Policy,
- Cookie Policy/consent where required,
- data export,
- account deletion,
- retention policy,
- vendor inventory,
- privacy-conscious analytics,
- data minimization,
- deletion and retention workflows.

Final legal language should receive qualified legal review.

## 24. Cost controls

Primary cost driver is AI generation, not basic hosting.

Cost reduction rules:
- use Vercel for app/orchestration, not MP4 delivery,
- use R2 for generated video delivery,
- keep public pages static where possible,
- lazy-load media/editor code,
- use efficient thumbnails,
- use mock generation in development,
- default users to economical models,
- do not offer unlimited generations,
- monitor provider cost per customer,
- retain generated media only for a defined period.

## 25. Environments

Development:
- mock generation default.
- Paystack test keys.

Preview/Staging:
- production-like database/schema.
- real provider only when explicitly enabled.

Production:
- live Paystack.
- live provider.
- strict rate/spend controls.
- production monitoring.

## 26. Testing requirements before launch

Must prove:
- cannot generate without authentication,
- cannot generate without active subscription,
- cannot generate without sufficient credits,
- cannot make credit balance negative,
- cannot modify plan/model price in browser to reduce server cost,
- cannot spend another user's credits,
- cannot read another user's projects,
- cannot read another user's videos,
- cannot replay payment webhook for extra credits,
- cannot double-fulfill a payment,
- cannot bypass concurrency limits,
- cannot expose server secrets,
- cannot submit unsupported model/duration/resolution,
- generation survives refresh/browser close,
- failed provider requests refund/release credits correctly.

## 27. Implementation roadmap

### Phase 0 — Architecture freeze
Finalize:
- plan definitions,
- credit economics,
- retention,
- provider cost mapping,
- core database model,
- security model,
- storage architecture.

Deliverable:
- approved architecture and schema.

### Phase 1 — Production repository/deployment
- make GitHub -> Vercel the canonical deployment path,
- patched Next.js,
- Node 22+,
- preview deployments,
- environment separation,
- dependency/security checks.

Acceptance:
- every PR/commit can produce a safe preview build.

### Phase 2 — Production authentication
- Supabase SSR auth,
- signup,
- login,
- logout,
- email verification,
- password reset,
- protected dashboard,
- session refresh,
- account deletion foundation.

Acceptance:
- unauthenticated users cannot access user data.

### Phase 3 — Core database
- profiles,
- projects,
- generations,
- assets,
- favorites,
- plans,
- subscriptions,
- payments,
- credit ledger/balances,
- webhook events,
- generation cost records,
- audit events,
- complete RLS,
- ownership integrity constraints.

Acceptance:
- cross-user access tests fail.

### Phase 4 — Paystack test integration
- test plans,
- checkout,
- callback,
- webhook,
- signature verification,
- transaction verification,
- subscription activation,
- cancellation,
- renewal,
- failed renewal.

Acceptance:
- one successful test payment creates exactly one subscription/credit allocation.

### Phase 5 — Credit engine
- reserve,
- capture,
- refund/release,
- monthly credit refresh,
- concurrency limits,
- daily limits,
- race-condition protection.

Acceptance:
- simultaneous requests cannot push balance below zero.

### Phase 6 — Full UI shell
Build all screenshot-level screens with mock data:
- landing,
- dashboard/projects,
- generate,
- generation progress,
- video details,
- history,
- templates,
- favorites,
- assets,
- settings,
- pricing,
- authentication,
- billing.

Acceptance:
- entire navigation and responsive layout work without real provider calls.

### Phase 7 — Mock generation
- full fake generation pipeline,
- processing states,
- history,
- projects,
- playback,
- errors/refunds.

Acceptance:
- full customer journey works without incurring AI cost.

### Phase 8 — Cloudflare R2
- private bucket,
- upload pipeline,
- signed URLs,
- thumbnails,
- deletion,
- retention jobs,
- ownership checks.

Acceptance:
- users cannot access another user's media.

### Phase 9 — Google Veo integration
- provider adapter,
- Lite/Fast/Standard,
- exact cost mapping,
- operation persistence,
- background polling,
- error mapping,
- credit accounting,
- R2 upload.

Acceptance:
- generation survives browser close/reopen and cost accounting is correct.

### Phase 10 — Production generator UI
- image upload,
- polished model selector,
- aspect ratio,
- duration,
- resolution,
- cost preview,
- progress,
- download,
- mobile QA.

### Phase 11 — Projects/history/assets
- search,
- filter,
- rename,
- archive,
- delete,
- move,
- favorites,
- retention.

### Phase 12 — Security pass
- threat model,
- rate limits,
- bot protection,
- WAF/CDN controls,
- CSP/security headers,
- cookie/security review,
- webhook security,
- upload security,
- audit logs,
- provider spend caps,
- key rotation process.

Acceptance:
- production security checklist complete before live billing.

### Phase 13 — Admin and observability
- revenue/cost dashboard,
- user/subscription support tools,
- generation failures,
- payment failures,
- webhook failures,
- queue/backlog monitoring,
- spend alerts,
- credit inconsistency alerts.

### Phase 14 — Marketing and SEO
- public landing and product pages,
- template pages,
- demo watch pages,
- schema/structured data,
- sitemap,
- robots,
- Search Console,
- analytics,
- country-level conversion tracking.

### Phase 15 — Privacy/legal readiness
- privacy/terms/AUP,
- cookie consent where required,
- export/delete,
- retention workflows,
- vendor/data inventory.

### Phase 16 — Closed paid beta
Measure:
- provider cost per user,
- credits consumed,
- failure rate,
- model preference,
- average duration,
- checkout conversion,
- retention,
- support volume,
- storage/customer.

Adjust pricing and limits from real data.

### Phase 17 — USA/Europe launch
- English US/UK first,
- optimize conversion,
- expand localized marketing pages,
- Germany,
- France,
- Spain,
- Netherlands,
- further EU markets based on traction.

## 28. Deliberately deferred features

Do not build initially:
- native mobile apps,
- teams/workspaces,
- public developer API,
- creator marketplace,
- advanced timeline editor,
- social feed,
- unlimited plan,
- affiliate system,
- custom model training,
- many video providers at once.

First make this workflow excellent:
Generate -> Pay -> Save -> Play -> Download.

## 29. Production launch gate

Do not call the product production-ready until:
- payment cannot be bypassed,
- subscription checks are server-side,
- credits cannot go negative,
- secrets never reach browser,
- media is private by default,
- RLS is verified,
- cross-user data access fails,
- provider spend has hard safeguards,
- generation requests are idempotent,
- payment/webhook processing is idempotent,
- failed generations settle credits correctly,
- terms/privacy/AUP exist,
- account deletion works,
- backups exist,
- logs and alerts exist,
- commercial hosting plan is active.

## 30. Current next milestone

Current recommended implementation order:
1. Finish Phase 0 architecture/schema decisions.
2. Make GitHub -> Vercel the canonical deployment path.
3. Upgrade authentication to Supabase SSR/cookies.
4. Add final billing/credit tables and integrity constraints.
5. Integrate Paystack in test mode.
6. Implement the credit reservation/capture/refund engine.
7. Then build the complete screenshot UI against mock generation.

## 31. Change-control rule

Whenever a major product, pricing, architecture, security, storage, payment, or launch decision changes:
- update this file,
- update the `Last updated` date,
- note affected phase(s),
- avoid making implementation changes that contradict this roadmap without deliberately revising the roadmap first.

This document is the canonical reference for future Veo AI Studio implementation decisions.