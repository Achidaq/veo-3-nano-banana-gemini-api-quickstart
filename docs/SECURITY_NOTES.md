# Veo AI Studio Security Notes

Last reviewed: 2026-09-03

## Browser trust boundary
Anything delivered to the browser is inspectable and must be treated as untrusted. The client does not determine subscription status, plan price, provider model cost, credit balance, credit deductions, payment success, file ownership, or provider credentials.

## Server-only secrets
Never expose these through `NEXT_PUBLIC_` variables or client components:
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `GEMINI_API_KEY`
- future R2 secret credentials

## Provider kill switches
Real provider calls remain disabled unless explicitly enabled server-side:
- `ENABLE_REAL_VEO_GENERATION=true`
- `ENABLE_REAL_IMAGE_GENERATION=true`

Production and preview should keep these false until the entitlement database, credit engine, RLS isolation tests, and spend controls pass.

## Veo request path
A billable Veo request must pass:
1. authenticated Supabase user,
2. active subscription,
3. supported Veo 3.1 model/resolution/duration,
4. plan concurrency limit,
5. atomic credit reservation,
6. explicit provider feature flag,
7. provider key present.

Credits are captured only after successful provider completion. Provider failure releases the reservation through idempotent service-role-only RPCs.

## Paystack
The browser callback is not payment proof. Payment fulfillment requires Paystack transaction verification and local amount/currency checks. Webhooks require HMAC-SHA512 verification and an idempotent stored event key. Credit grants use a unique idempotency key.

## Media downloads
Do not allow arbitrary user-provided upstream URLs to receive provider credentials. The temporary Google video download proxy allows only authenticated requests and the approved Google API hostname. This proxy should be retired once completed videos are uploaded to private Cloudflare R2 objects and delivered using short-lived signed URLs.

## Database
All exposed user-owned tables require RLS. Cross-user project/generation ownership is also enforced by a composite database foreign key, not only by application code.
