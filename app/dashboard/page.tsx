"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth/AuthGate";
import { createProject, listProjects } from "@/lib/supabase/projects";

type Project = {
  id: string;
  title: string;
  description?: string | null;
  updated_at: string;
};

function DashboardContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const rows = await listProjects();
      setProjects(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const project = await createProject(title.trim());
      setProjects((current) => [project, ...current]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-stone-500">Veo Studio</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your projects</h1>
            <p className="mt-2 text-stone-500">Create a project, then use the generator and keep the work organized.</p>
          </div>
          <Link href="/" className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white">
            Open generator
          </Link>
        </div>

        <form onSubmit={submit} className="mb-8 flex max-w-xl gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New project name"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-stone-400"
          />
          <button disabled={busy} className="rounded-xl bg-white px-5 py-3 font-medium shadow-sm disabled:opacity-50">
            {busy ? "Creating…" : "Create"}
          </button>
        </form>

        {error ? <p className="mb-6 text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <p className="text-stone-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white/50 p-12 text-center text-stone-500">
            No projects yet. Create the first one above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="font-semibold">{project.title}</h2>
                <p className="mt-2 text-xs text-stone-400">
                  Updated {new Date(project.updated_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
