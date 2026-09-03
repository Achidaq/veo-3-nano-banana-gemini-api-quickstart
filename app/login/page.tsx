import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-white grid place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.28em] text-violet-300">VEO AI STUDIO</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-white/60">Access your projects, credits, and generation history.</p>

        {params.error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{params.error}</div> : null}
        {params.message ? <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{params.message}</div> : null}

        <form action={signIn} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <label className="block text-sm text-white/80">Email
            <input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400" />
          </label>
          <label className="block text-sm text-white/80">Password
            <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400" />
          </label>
          <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold hover:bg-violet-400">Sign in</button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-white/60 hover:text-white">Forgot password?</Link>
          <Link href="/signup" className="text-violet-300 hover:text-violet-200">Create account</Link>
        </div>
      </section>
    </main>
  );
}
