alter table public.subscriptions
  add column billing_email text,
  add column provider_plan_code text;

create index subscriptions_billing_email_idx on public.subscriptions(lower(billing_email));
create index subscriptions_provider_customer_idx on public.subscriptions(provider_customer_code);
create index subscriptions_provider_plan_idx on public.subscriptions(provider_plan_code);
