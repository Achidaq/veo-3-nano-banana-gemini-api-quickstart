const STORAGE_KEY = "veo_supabase_session";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
  };
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

function saveSession(session: AuthSession) {
  const expiresAt = Math.floor(Date.now() / 1000) + session.expires_in;
  const value = { ...session, expires_at: expiresAt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

async function authRequest(path: string, body: unknown) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || "Authentication failed");
  return data;
}

export async function signIn(email: string, password: string) {
  const session = await authRequest("token?grant_type=password", { email, password });
  return saveSession(session as AuthSession);
}

export async function signUp(email: string, password: string) {
  const result = await authRequest("signup", { email, password });
  if (result.access_token) saveSession(result as AuthSession);
  return result as AuthSession;
}

export async function signOut() {
  const session = readSession();
  const { url, key } = config();
  if (session?.access_token) {
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
      },
    }).catch(() => undefined);
  }
  clearSession();
}

async function refreshSession(session: AuthSession) {
  const refreshed = await authRequest("token?grant_type=refresh_token", {
    refresh_token: session.refresh_token,
  });
  return saveSession(refreshed as AuthSession);
}

export async function getAccessToken() {
  let session = readSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at - now < 60) {
    try {
      session = await refreshSession(session);
    } catch {
      clearSession();
      return null;
    }
  }
  return session.access_token;
}

export async function getCurrentUser() {
  const token = await getAccessToken();
  if (!token) return null;
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  return response.json();
}
