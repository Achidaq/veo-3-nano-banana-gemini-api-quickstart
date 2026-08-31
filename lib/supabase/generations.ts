import { getAccessToken, readSession } from "./browser";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

export async function listGenerations(projectId?: string) {
  const token = await getAccessToken();
  if (!token) return [];
  const { url, key } = getConfig();
  const filter = projectId ? `&project_id=eq.${encodeURIComponent(projectId)}` : "";
  const response = await fetch(`${url}/rest/v1/generations?select=*&order=created_at.desc${filter}`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Could not load generation history");
  return response.json();
}

export async function createGeneration(input: {
  projectId?: string;
  kind: "video" | "image" | "edit";
  model: string;
  prompt: string;
  operationName?: string;
}) {
  const session = readSession();
  const token = await getAccessToken();
  if (!session?.user?.id || !token) throw new Error("Not authenticated");
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/generations`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      project_id: input.projectId ?? null,
      kind: input.kind,
      model: input.model,
      prompt: input.prompt,
      operation_name: input.operationName ?? null,
      status: input.operationName ? "processing" : "queued",
    }),
  });
  if (!response.ok) throw new Error("Could not save generation");
  const rows = await response.json();
  return rows[0];
}

export async function setGenerationStatus(
  id: string,
  status: "processing" | "completed" | "failed" | "cancelled",
  values: { operationName?: string; outputPath?: string; errorMessage?: string } = {}
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/generations?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      operation_name: values.operationName,
      output_path: values.outputPath,
      error_message: values.errorMessage,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error("Could not update generation");
}
