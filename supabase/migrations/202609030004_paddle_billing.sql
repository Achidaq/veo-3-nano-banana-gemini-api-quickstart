alter table public.plans
  add column if not exists provider_price_id text;

create unique index if not exists plans_provider_price_id_unique
  on public.plans(provider_price_id)
  where provider_price_id is not null;

create index if not exists subscriptions_provider_subscription_code_idx
  on public.subscriptions(provider_subscription_code)
  where provider_subscription_code is not null;

comment on column public.plans.provider_price_id is
  'Billing provider price identifier, e.g. Paddle pri_*; server controlled.';
