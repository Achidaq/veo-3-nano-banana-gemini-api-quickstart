"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProjectAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { error } = await supabase.from("projects").insert({
    user_id: user.id,
    title: title.slice(0, 120),
  });

  if (error) {
    throw new Error("Could not create project");
  }

  revalidatePath("/dashboard");
}
