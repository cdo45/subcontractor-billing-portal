"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { useSessionWithRole } from "@/lib/useSession";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import { fmtUSD, fmtPct } from "@/lib/calc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

interface Summary {
  metrics: {
    activeProjects: number;
    completedProjects: number;
    pendingApproval: number;
    pendingCOs: number;
    billedThisMonth: number;
    grandBilled: number;
  };
  projects: Array<{
    id: string;
    projectNumber: string;
    name: string;
    client: string;
    status: string;
    contractValue: number;
    adjustedContractValue: number;
    billedToDate: number;
    pctComplete: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const session = useSessionWithRole(["admin", "pm"]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!session) return;
    api<Summary>("/api/dashboard/summary").then((r) => setSummary(r.data));
  }, [session]);

  if (!summary) {
    return (
      <>
        <Header />
        <main style={{ padding: 24 }}>Loading…</main>
      </>
    );
  }

  const metrics = summary.metrics;
  const chartData = summary.projects
    .filter((p) => p.status !== "completed")
    .map((p) => ({
      name: p.projectNumber,
      "Contract Value": p.adjustedContractValue,
      "Billed To Date": p.billedToDate
    }));

  return (
    <>
      <Header />
      <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 20 }}>Dashboard</h1>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 28
          }}
        >
          <MetricCard label="Active Projects" value={String(metrics.activeProjects)} />
          <MetricCard
            label="Billings Pending Approval"
            value={String(metrics.pendingApproval)}
            accent={metrics.pendingApproval > 0 ? "warning" : undefined}
          />
          <MetricCard
            label="Change Orders Pending"
            value={String(metrics.pendingCOs)}
            accent={metrics.pendingCOs > 0 ? "warning" : undefined}
          />
          <MetricCard
            label="Billed This Month"
            value={fmtUSD(metrics.billedThisMonth)}
          />
        </section>

        <section className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Projects</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Project #</th>
                  <th>Name</th>
                  <th>Client</th>
                  <th className="num">Contract</th>
                  <th className="num">Billed</th>
                  <th className="num">% Complete</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="mono">{p.projectNumber}</td>
                    <td>{p.name}</td>
                    <td>{p.client}</td>
                    <td className="num">{fmtUSD(p.adjustedContractValue)}</td>
                    <td className="num">{fmtUSD(p.billedToDate)}</td>
                    <td className="num">{fmtPct(p.pctComplete)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {chartData.length > 0 && (
          <section className="card">
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>
              Billed vs Contract Value (Active Projects)
            </h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#888" style={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#888"
                    style={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid #333",
                      color: "#fff"
                    }}
                    formatter={(v: number) => fmtUSD(v)}
                  />
                  <Bar dataKey="Contract Value" fill="#444" />
                  <Bar dataKey="Billed To Date" fill="#ffffff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function MetricCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: "warning" | "danger" | "success";
}) {
  const color =
    accent === "warning"
      ? "var(--warning)"
      : accent === "danger"
      ? "var(--danger)"
      : accent === "success"
      ? "var(--success)"
      : "var(--text-primary)";
  return (
    <div className="card">
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 28,
          color
        }}
      >
        {value}
      </div>
    </div>
  );
}
