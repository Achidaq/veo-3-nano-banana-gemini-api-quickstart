"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { getCurrentUser, signIn, signOut, signUp } from "@/lib/supabase/browser";

type User = { id: string; email?: string };

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((current) => setUser(current))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      const current = await getCurrentUser();
      if (!current) {
        setError("Check your email to confirm your account, then sign in.");
      } else {
        setUser(current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut();
    setUser(null);
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-gray-200 text-stone-700">Loading studio…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-200 px-4 text-stone-900">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <p className="mb-2 text-sm font-medium text-stone-500">Veo Studio</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to create" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-stone-500">Your projects and generation history will be saved securely.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-stone-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              minLength={6}
              required
              className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-stone-400"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="mt-5 w-full text-sm text-stone-600 underline underline-offset-4"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full bg-white/95 px-4 py-2 text-sm shadow-sm backdrop-blur">
        <span className="max-w-48 truncate text-stone-600">{user.email}</span>
        <button onClick={logout} className="font-medium text-stone-900">Sign out</button>
      </div>
      {children}
    </div>
  );
}
