create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create unique index if not exists projects_id_user_id_uidx on public.projects(id, user_id);

alter table public.generations drop constraint if exists generations_project_id_fkey;
alter table public.generations
  add constraint generations_project_user_fkey
  foreign key (project_id, user_id)
  references public.projects(id, user_id)
  on delete cascade;

alter table public.generations drop constraint if exists generations_status_check;
alter table public.generations
  add constraint generations_status_check
  check (status in ('queued','reserved','submitting','processing','uploading','completed','failed','cancelled'));

create table public.plans (
  id text primary key,
  name text not null unique,
  currency text not null,
  price_minor bigint not null check (price_minor > 0),
  monthly_credits integer not null check (monthly_credits > 0),
  max_concurrent_generations integer not null check (max_concurrent_generations > 0),
  retention_days integer not null check (retention_days > 0),
  paystack_plan_code text unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('pending','active','past_due','cancelled','expired')),
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_customer_code text,
  provider_subscription_code text unique,
  provider_email_token text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_live_subscription_per_user
on public.subscriptions(user_id)
where status in ('pending','active','past_due');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  provider_transaction_id bigint,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  status text not null check (status in ('pending','success','failed','refunded')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  entry_type text not null check (entry_type in ('subscription_grant','purchase_grant','generation_reserve','generation_capture','generation_release','refund','admin_adjustment','expiration')),
  amount integer not null check (amount <> 0),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  kind text not null check (kind in ('image','video','thumbnail','reference')),
  object_key text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete cascade
);

create index assets_user_created_idx on public.assets(user_id, created_at desc);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid not null references public.generations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'paystack'),
  event_key text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider, event_key)
);

create table public.generation_costs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null unique references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google',
  provider_model text not null,
  duration_seconds numeric(8,2),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  actual_cost_usd numeric(12,6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  credits_captured integer not null default 0 check (credits_captured >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_user_created_idx on public.audit_events(user_id, created_at desc);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.assets enable row level security;
alter table public.favorites enable row level security;
alter table public.webhook_events enable row level security;
alter table public.generation_costs enable row level security;
alter table public.audit_events enable row level security;

grant select on public.plans to anon, authenticated;
grant select on public.subscriptions, public.payments, public.credit_balances, public.credit_ledger, public.assets, public.favorites, public.generation_costs to authenticated;
grant insert, update, delete on public.assets, public.favorites to authenticated;

create policy plans_public_read on public.plans for select to anon, authenticated using (is_active = true);
create policy subscriptions_select_own on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy payments_select_own on public.payments for select to authenticated using ((select auth.uid()) = user_id);
create policy credit_balances_select_own on public.credit_balances for select to authenticated using ((select auth.uid()) = user_id);
create policy credit_ledger_select_own on public.credit_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy generation_costs_select_own on public.generation_costs for select to authenticated using ((select auth.uid()) = user_id);
create policy assets_select_own on public.assets for select to authenticated using ((select auth.uid()) = user_id);
create policy assets_insert_own on public.assets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assets_update_own on public.assets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assets_delete_own on public.assets for delete to authenticated using ((select auth.uid()) = user_id);
create policy favorites_select_own on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_insert_own on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_delete_own on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger generations_set_updated_at before update on public.generations for each row execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger credit_balances_set_updated_at before update on public.credit_balances for each row execute function public.set_updated_at();
create trigger generation_costs_set_updated_at before update on public.generation_costs for each row execute function public.set_updated_at();
