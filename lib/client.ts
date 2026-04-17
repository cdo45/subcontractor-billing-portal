"use client";

// API fetch helper. Clerk attaches session cookies automatically — we just
// use `credentials: "include"` style is not needed since Clerk uses same-origin
// cookies by default for server components and route handlers.
export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as any) || {})
  };
  const res = await fetch(path, { ...options, headers });
  try {
    const json = await res.json();
    return { data: json.data, error: json.error, status: res.status };
  } catch {
    return { data: null, error: "Parse error", status: res.status };
  }
}
