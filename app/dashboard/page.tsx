import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProjectAction } from "./actions";
import { signOut } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,title,description,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-violet-300">VEO AI STUDIO</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your projects</h1>
            <p className="mt-2 text-white/55">Create a project, generate videos, and keep every asset attached to your account.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium">Open generator</Link>
            <form action={signOut}><button className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black">Sign out</button></form>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
          Signed in as <span className="text-white">{user.email}</span>
        </div>

        <form action={createProjectAction} className="mb-8 flex max-w-xl gap-3">
          <input name="title" required maxLength={120} placeholder="New project name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 outline-none focus:border-violet-400" />
          <button className="rounded-xl bg-violet-500 px-5 py-3 font-semibold hover:bg-violet-400">Create</button>
        </form>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">Could not load your projects.</div>
        ) : !projects?.length ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-12 text-center text-white/50">No projects yet. Create the first one above.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <h2 className="font-semibold">{project.title}</h2>
                {project.description ? <p className="mt-2 text-sm text-white/50">{project.description}</p> : null}
                <p className="mt-4 text-xs text-white/35">Updated {new Date(project.updated_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
