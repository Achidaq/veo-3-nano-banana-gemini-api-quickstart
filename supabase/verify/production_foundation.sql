-- Post-migration verification for Veo AI Studio.
-- Run only after applying 202609030001, 202609030002, and 202609030003.
-- This script is intentionally read-only. Functional credit tests belong in an isolated test user flow.

-- 1) Required tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','projects','generations','plans','subscriptions','payments',
    'credit_balances','credit_ledger','assets','favorites','webhook_events',
    'generation_costs','audit_events'
  )
order by table_name;

-- Expected: 13 rows.

-- 2) RLS is enabled on every exposed/user-owned table.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','projects','generations','plans','subscriptions','payments',
    'credit_balances','credit_ledger','assets','favorites','webhook_events',
    'generation_costs','audit_events'
  )
order by c.relname;

-- Expected: rls_enabled = true for every row.

-- 3) Inspect policies and roles. Server-only tables should not have permissive client write policies.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','projects','generations','plans','subscriptions','payments',
    'credit_balances','credit_ledger','assets','favorites','webhook_events',
    'generation_costs','audit_events'
  )
order by tablename, policyname;

-- 4) Verify generation ownership is enforced by a composite FK.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.generations'::regclass
  and contype = 'f'
order by conname;

-- Expected definition includes FOREIGN KEY (project_id, user_id)
-- REFERENCES projects(id, user_id).

-- 5) Verify the projects composite unique index used by that FK.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'projects'
order by indexname;

-- Expected: a unique index on (id, user_id).

-- 6) Verify credit functions exist and are service-role only.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proacl as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'grant_credits',
    'reserve_generation_credits',
    'capture_generation_credits',
    'release_generation_credits'
  )
order by p.proname;

-- Expected: all four functions present; anon/authenticated must not have EXECUTE.

-- 7) Verify no negative balances are currently stored.
select user_id, available, reserved
from public.credit_balances
where available < 0 or reserved < 0;

-- Expected: 0 rows.

-- 8) Check duplicate external payment references and webhook event keys.
select provider_reference, count(*)
from public.payments
group by provider_reference
having count(*) > 1;

select provider, event_key, count(*)
from public.webhook_events
group by provider, event_key
having count(*) > 1;

-- Expected: 0 rows from both queries.

-- 9) Check duplicate credit ledger idempotency keys.
select idempotency_key, count(*)
from public.credit_ledger
group by idempotency_key
having count(*) > 1;

-- Expected: 0 rows.

-- 10) Check that live subscription uniqueness is enforced.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'subscriptions'
order by indexname;

-- Expected: one_live_subscription_per_user partial unique index.

-- 11) Verify updated_at triggers exist where required.
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in (
    'profiles','projects','generations','plans','subscriptions','payments',
    'credit_balances','generation_costs'
  )
order by event_object_table, trigger_name;

-- 12) Verify plans are not accidentally activated without real Paystack plan codes/pricing.
select id, name, currency, price_minor, monthly_credits, paystack_plan_code, is_active
from public.plans
order by id;

-- Production rule: do not activate a plan until price_minor, currency and
-- paystack_plan_code exactly match the Paystack TEST plan during test mode,
-- then the LIVE plan during production cutover.
