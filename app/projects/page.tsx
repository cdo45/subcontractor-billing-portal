"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useSessionWithRole } from "@/lib/useSession";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import { fmtUSD, fmtPct } from "@/lib/calc";

export default function ProjectsListPage() {
  const router = useRouter();
  const session = useSessionWithRole(["admin", "pm"]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!session) return;
    api<any[]>("/api/projects").then((r) => {
      if (r.data) setProjects(r.data);
    });
  }, [session]);

  return (
    <>
      <Header />
      <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 20 }}>All Projects</h1>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Project #</th>
                <th>Name</th>
                <th>Client</th>
                <th>PM</th>
                <th className="num">Contract</th>
                <th className="num">Billed</th>
                <th className="num">% Complete</th>
                <th className="num">Pending</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="mono">{p.projectNumber}</td>
                  <td>{p.name}</td>
                  <td>{p.client}</td>
                  <td>{p.pm.name}</td>
                  <td className="num">{fmtUSD(p.adjustedContractValue)}</td>
                  <td className="num">{fmtUSD(p.billedToDate)}</td>
                  <td className="num">{fmtPct(p.pctComplete)}</td>
                  <td className="num">
                    {p.pendingBillings + p.pendingCOs}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
