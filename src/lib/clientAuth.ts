"use client";

const TOKEN_KEY = "polhub_token";

export function saveToken(token: string | undefined | null) {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* prywatny tryb przeglądarki – trudno, zostaje ciasteczko */
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** fetch, który dokleja token sesji – działa też bez ciasteczek (iframe). */
export function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include" });
}

export async function fetchMe(): Promise<string | null> {
  try {
    const res = await authFetch("/api/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.user === "string" ? data.user : null;
  } catch {
    return null;
  }
}
export type MeInfo = {
  user: string | null;
  verified: boolean;
  sensei: boolean;
  admin: boolean;
};

/** Sesja + informacje o odznace (działa też bez ciasteczek). */
export async function fetchMeInfo(): Promise<MeInfo> {
  try {
    const res = await authFetch("/api/me", { cache: "no-store" });
    if (!res.ok) return { user: null, verified: false, sensei: false, admin: false };
    const data = await res.json();
    return {
      user: typeof data.user === "string" ? data.user : null,
      verified: data.verified === true,
      sensei: data.sensei === true,
      admin: data.admin === true || data.sensei === true,
    };
  } catch {
    return { user: null, verified: false, sensei: false, admin: false };
  }
}
