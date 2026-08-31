import { getAccessToken, readSession } from "./browser";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

export async function listProjects() {
  const token = await getAccessToken();
  if (!token) return [];
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/projects?select=*&order=updated_at.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Could not load projects");
  return response.json();
}

export async function createProject(title: string) {
  const session = readSession();
  const token = await getAccessToken();
  if (!session?.user?.id || !token) throw new Error("Not authenticated");
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/projects`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ user_id: session.user.id, title }),
  });
  if (!response.ok) throw new Error("Could not create project");
  const rows = await response.json();
  return rows[0];
}
