"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function cleanNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function withMessage(path: string, key: "error" | "message", value: string) {
  const params = new URLSearchParams({ [key]: value });
  return `${path}?${params.toString()}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = cleanNext(formData.get("next"));

  if (!email || !password) {
    redirect(withMessage("/login", "error", "Email and password are required."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withMessage("/login", "error", "Invalid email or password."));
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect(withMessage("/signup", "error", "Use a valid email and a password of at least 8 characters."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
    },
  });

  if (error) {
    redirect(withMessage("/signup", "error", "Unable to create the account."));
  }

  redirect(withMessage("/login", "message", "Check your email to verify your account before signing in."));
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(withMessage("/forgot-password", "error", "Enter your email address."));
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/update-password`,
  });

  redirect(withMessage("/forgot-password", "message", "If an account exists for that email, a reset link has been sent."));
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirect(withMessage("/update-password", "error", "Password must be at least 8 characters."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(withMessage("/update-password", "error", "The reset session is invalid or expired. Request another reset link."));
  }

  redirect(withMessage("/login", "message", "Password updated. Sign in with your new password."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
