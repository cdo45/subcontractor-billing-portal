"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";

export interface SessionInfo {
  userId: string; // Prisma User.id
  email: string;
  name: string;
  role: "admin" | "pm" | "subcontractor";
  companyName: string | null;
}

// Fetches the server-side session (Clerk + Prisma) and optionally enforces
// role. Returns null while loading, then the session object or redirects.
export function useSessionWithRole(
  allowed: Array<"admin" | "pm" | "subcontractor">
): SessionInfo | null {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await api<SessionInfo>("/api/auth/me");
      if (cancelled) return;
      if (r.status === 401 || !r.data) {
        router.replace("/login");
        return;
      }
      if (!allowed.includes(r.data.role)) {
        router.replace(r.data.role === "subcontractor" ? "/sub-portal" : "/dashboard");
        return;
      }
      setSession(r.data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return session;
}
