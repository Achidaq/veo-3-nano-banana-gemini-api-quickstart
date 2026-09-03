import { redirect } from "next/navigation";
import CheckoutButton from "@/components/billing/CheckoutButton";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/billing");

  const params = await searchParams;
  const paymentState = typeof params.payment === "string" ? params.payment : null;

  const [{ data: plans }, { data: subscription }, { data: balance }] = await Promise.all([
    supabase
      .from("plans")
      .select("id,name,currency,price_minor,monthly_credits,max_concurrent_generations,retention_days,paystack_plan_code")
      .eq("is_active", true)
      .order("price_minor", { ascending: true }),
    supabase
      .from("subscriptions")
      .select("id,status,plan_id,current_period_end,cancel_at_period_end")
      .in("status", ["pending", "active", "past_due"])
      .maybeSingle(),
    supabase
      .from("credit_balances")
      .select("available,reserved")
      .maybeSingle(),
  ]);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-violet-300">Veo AI Studio</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Plan & billing</h1>
            <p className="mt-2 max-w-2xl text-stone-400">
              Real AI generation is available only with an active paid plan. Credits are enforced server-side before provider calls.
            </p>
          </div>
          <div className="rounded-2xl border border-stone-800 bg-stone-900 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">Credits</p>
            <p className="mt-1 text-2xl font-semibold">{balance?.available ?? 0}</p>
            <p className="text-xs text-stone-500">{balance?.reserved ?? 0} reserved</p>
          </div>
        </div>

        {paymentState ? (
          <div className="mb-8 rounded-2xl border border-stone-800 bg-stone-900 p-4 text-sm text-stone-300">
            Payment status: <span className="font-semibold text-white">{paymentState}</span>
          </div>
        ) : null}

        {subscription ? (
          <section className="mb-10 rounded-3xl border border-violet-500/30 bg-violet-500/10 p-6">
            <p className="text-sm text-violet-200">Current subscription</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <h2 className="text-2xl font-semibold capitalize">{subscription.plan_id}</h2>
              <span className="rounded-full border border-violet-400/30 px-3 py-1 text-xs uppercase tracking-wide text-violet-200">
                {subscription.status}
              </span>
            </div>
            {subscription.current_period_end ? (
              <p className="mt-3 text-sm text-stone-400">
                Current period ends {new Date(subscription.current_period_end).toLocaleDateString()}.
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-5 md:grid-cols-3">
          {(plans || []).map((plan) => (
            <article key={plan.id} className="rounded-3xl border border-stone-800 bg-stone-900 p-6">
              <h2 className="text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-2 text-3xl font-semibold">
                {(plan.price_minor / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: plan.currency,
                })}
                <span className="text-sm font-normal text-stone-500"> / month</span>
              </p>
              <ul className="my-6 space-y-2 text-sm text-stone-300">
                <li>{plan.monthly_credits} monthly credits</li>
                <li>{plan.max_concurrent_generations} concurrent generation{plan.max_concurrent_generations === 1 ? "" : "s"}</li>
                <li>{plan.retention_days}-day media retention</li>
              </ul>
              {subscription ? (
                <button disabled className="w-full rounded-xl border border-stone-700 px-4 py-3 text-sm text-stone-500">
                  Manage current plan
                </button>
              ) : plan.paystack_plan_code ? (
                <CheckoutButton planId={plan.id} />
              ) : (
                <button disabled className="w-full rounded-xl border border-stone-700 px-4 py-3 text-sm text-stone-500">
                  Checkout not configured
                </button>
              )}
            </article>
          ))}
        </div>

        {!plans?.length ? (
          <div className="rounded-3xl border border-dashed border-stone-800 p-10 text-center text-stone-500">
            Subscription plans are not active yet. They will appear here after Paystack test plans and final prices are configured.
          </div>
        ) : null}
      </div>
    </main>
  );
}
