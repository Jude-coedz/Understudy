export type SupabaseRuntimeConfig = {
  configured: boolean;
  url: string;
  publishableKey: string;
  source: "cloudflare-bindings" | "process-env" | "missing";
};

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  user?: SupabaseUser;
};

const SESSION_KEY = "understudy:supabase-session:v1";
let cachedConfig: SupabaseRuntimeConfig | null = null;
let refreshPromise: Promise<SupabaseSession | null> | null = null;

function browser() {
  return typeof window !== "undefined";
}

export async function loadSupabaseConfig(force = false): Promise<SupabaseRuntimeConfig> {
  if (cachedConfig && !force) return cachedConfig;
  try {
    const response = await fetch("/api/supabase-config", { cache: "no-store" });
    if (!response.ok) throw new Error("config unavailable");
    const config = (await response.json()) as SupabaseRuntimeConfig;
    if (config.configured && config.url && config.publishableKey) cachedConfig = config;
    return config;
  } catch {
    return { configured: false, url: "", publishableKey: "", source: "missing" };
  }
}

function readStoredSession(): SupabaseSession | null {
  if (!browser()) return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SupabaseSession;
    return session?.access_token && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}

export function storeSupabaseSession(session: SupabaseSession) {
  if (!browser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("understudy:auth-changed"));
}

export function clearSupabaseSession() {
  if (!browser()) return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("understudy:auth-changed"));
}

async function refreshSession(session: SupabaseSession): Promise<SupabaseSession | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const config = await loadSupabaseConfig();
    if (!config.configured) return null;
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) {
      clearSupabaseSession();
      return null;
    }
    const payload = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      token_type?: string;
      user?: SupabaseUser;
    };
    const next: SupabaseSession = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600),
      token_type: payload.token_type ?? "bearer",
      user: payload.user,
    };
    storeSupabaseSession(next);
    return next;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function getSupabaseSession(): Promise<SupabaseSession | null> {
  const session = readStoredSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  return refreshSession(session);
}

export async function getSupabaseUser(session = await getSupabaseSession()): Promise<SupabaseUser | null> {
  if (!session) return null;
  if (session.user?.id) return session.user;
  const config = await loadSupabaseConfig();
  if (!config.configured) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  storeSupabaseSession({ ...session, user });
  return user;
}

export async function signInWithSupabaseGoogle() {
  const config = await loadSupabaseConfig(true);
  if (!config.configured) {
    throw new Error("Account sync is not configured on this deployment yet.");
  }
  const redirectTo = `${window.location.origin}/auth/callback`;
  const url = new URL(`${config.url}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", redirectTo);
  window.location.assign(url.toString());
}

export async function completeSupabaseOAuthFromHash(hash: string) {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = values.get("access_token");
  const refreshToken = values.get("refresh_token");
  if (!accessToken || !refreshToken) {
    const error = values.get("error_description") || values.get("error");
    throw new Error(error || "Supabase did not return a usable session.");
  }
  const expiresIn = Number(values.get("expires_in") || "3600");
  const session: SupabaseSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    token_type: values.get("token_type") || "bearer",
  };
  storeSupabaseSession(session);
  const user = await getSupabaseUser(session);
  return user;
}

export async function signOutSupabase() {
  const session = await getSupabaseSession();
  const config = await loadSupabaseConfig();
  if (session && config.configured) {
    await fetch(`${config.url}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    }).catch(() => undefined);
  }
  clearSupabaseSession();
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  const config = await loadSupabaseConfig();
  const session = await getSupabaseSession();
  if (!config.configured || !session) throw new Error("Sign in to sync this workspace.");
  const headers = new Headers(init.headers);
  headers.set("apikey", config.publishableKey);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  return fetch(`${config.url}/rest/v1/${path}`, { ...init, headers });
}
