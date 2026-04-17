"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface MeResponse {
  role: "admin" | "pm" | "subcontractor";
  name: string;
  email: string;
  companyName: string | null;
}

export default function Header() {
  const { isLoaded, isSignedIn } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    api<MeResponse>("/api/auth/me").then((r) => {
      if (r.data) setMe(r.data);
    });
  }, [isSignedIn]);

  if (!isLoaded || !isSignedIn || !me) return null;

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-secondary)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Link
          href={me.role === "subcontractor" ? "/sub-portal" : "/dashboard"}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "-0.02em"
          }}
        >
          VANCE CORP
        </Link>
        <nav style={{ display: "flex", gap: 18, fontSize: 13 }}>
          {me.role !== "subcontractor" && (
            <>
              <Link href="/dashboard" style={{ color: "var(--text-secondary)" }}>
                Dashboard
              </Link>
              <Link href="/projects" style={{ color: "var(--text-secondary)" }}>
                Projects
              </Link>
            </>
          )}
          {me.role === "subcontractor" && (
            <Link href="/sub-portal" style={{ color: "var(--text-secondary)" }}>
              My Projects
            </Link>
          )}
        </nav>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--text-primary)" }}>{me.companyName || me.name}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {me.email} — {me.role.toUpperCase()}
          </div>
        </div>
        <SignOutButton redirectUrl="/login">
          <button className="btn">Sign out</button>
        </SignOutButton>
      </div>
    </header>
  );
}
