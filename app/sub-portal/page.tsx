"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { useSessionWithRole } from "@/lib/useSession";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import { fmtUSD, fmtPct } from "@/lib/calc";

export default function SubPortalPage() {
  const router = useRouter();
  const session = useSessionWithRole(["subcontractor"]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [busyContract, setBusyContract] = useState<string | null>(null);

  async function load() {
    const r = await api<any[]>("/api/sub/contracts");
    if (r.data) setContracts(r.data);
  }

  useEffect(() => {
    if (!session) return;
    load();
  }, [session]);

  const companyName = session?.companyName || session?.name || "";

  async function startNewBilling(contractId: string) {
    const now = new Date();
    setBusyContract(contractId);
    const r = await api<any>("/api/billing/period", {
      method: "POST",
      body: JSON.stringify({
        contractId,
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear()
      })
    });
    setBusyContract(null);
    if (r.error) {
      alert(r.error);
      return;
    }
    router.push(`/sub-portal/billing/${r.data.id}`);
  }

  return (
    <>
      <Header />
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8 }}>Welcome, {companyName}</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Your assigned projects and billing submissions.
        </p>

        {contracts.length === 0 && (
          <div className="card" style={{ color: "var(--text-muted)" }}>
            No contracts assigned yet.
          </div>
        )}

        {contracts.map((c) => {
          const now = new Date();
          const currentMonthPeriod = c.billingPeriods.find(
            (bp: any) =>
              bp.periodMonth === now.getMonth() + 1 &&
              bp.periodYear === now.getFullYear()
          );
          return (
            <div className="card" key={c.contractId} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.projectNumber} — {c.client}
                  </div>
                  <h3 style={{ margin: "4px 0 0" }}>{c.projectName}</h3>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
                    {c.description}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    Contract Value
                  </div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18 }}>
                    {fmtUSD(c.contractValue)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Billed: {fmtUSD(c.billedToDate)} ({fmtPct(c.pctComplete)})
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                {currentMonthPeriod ? (
                  <Link
                    className="btn btn-primary"
                    href={`/sub-portal/billing/${currentMonthPeriod.id}`}
                  >
                    Continue {monthName(currentMonthPeriod.periodMonth)} Billing (
                    <StatusBadge status={currentMonthPeriod.status} />)
                  </Link>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => startNewBilling(c.contractId)}
                    disabled={busyContract === c.contractId}
                  >
                    + Start New Billing
                  </button>
                )}
              </div>

              {c.billingPeriods.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      marginBottom: 8
                    }}
                  >
                    Billing History
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th className="num">This Period</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.billingPeriods.map((bp: any) => (
                        <tr key={bp.id}>
                          <td>
                            {monthName(bp.periodMonth)} {bp.periodYear}
                          </td>
                          <td className="num">{fmtUSD(bp.periodTotal)}</td>
                          <td>
                            <StatusBadge status={bp.status} />
                          </td>
                          <td>
                            {bp.submittedAt
                              ? new Date(bp.submittedAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link className="btn" href={`/sub-portal/billing/${bp.id}`}>
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </>
  );
}

function monthName(m: number) {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ][m - 1];
}
