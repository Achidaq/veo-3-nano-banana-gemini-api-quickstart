import { updatePassword } from "@/app/auth/actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-white grid place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.28em] text-violet-300">VEO AI STUDIO</p>
        <h1 className="mt-3 text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-white/60">Your reset link creates a temporary authenticated session for this change.</p>

        {params.error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{params.error}</div> : null}

        <form action={updatePassword} className="mt-6 space-y-4">
          <label className="block text-sm text-white/80">New password
            <input name="password" type="password" minLength={8} autoComplete="new-password" required className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400" />
          </label>
          <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold hover:bg-violet-400">Update password</button>
        </form>
      </section>
    </main>
  );
}
