"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useSessionWithRole } from "@/lib/useSession";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import BillingReviewModal from "@/components/BillingReviewModal";
import ChangeOrderForm from "@/components/ChangeOrderForm";
import { fmtUSD, fmtPct, fmtQty } from "@/lib/calc";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const session = useSessionWithRole(["admin", "pm"]);
  const [tab, setTab] = useState<"overview" | "billing" | "change_orders" | "contracts">("overview");
  const [data, setData] = useState<any>(null);
  const [reviewingPeriod, setReviewingPeriod] = useState<string | null>(null);
  const [coFormOpen, setCoFormOpen] = useState(false);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await api(`/api/projects/${params.id}`);
    if (r.data) setData(r.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    load();
  }, [session, params.id]);

  if (loading) {
    return (
      <>
        <Header />
        <main style={{ padding: 24 }}>Loading…</main>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Header />
        <main style={{ padding: 24 }}>Project not found.</main>
      </>
    );
  }

  const { project, metrics, contracts, changeOrders, billingPeriods, subBreakdown } = data;

  async function coAction(id: string, kind: "pm-approve" | "pm-reject" | "customer-approve") {
    let comments = "";
    if (kind === "pm-reject") {
      comments = prompt("Rejection reason:") || "";
      if (!comments) return;
    }
    const r = await api(`/api/change-orders/${id}/${kind}`, {
      method: "POST",
      body: JSON.stringify({ comments })
    });
    if (r.error) {
      alert(r.error);
      return;
    }
    load();
  }

  return (
    <>
      <Header />
      <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 13 }}>
          <span className="mono">{project.projectNumber}</span> — {project.client}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>

        <div className="tabs">
          <div className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            Overview
          </div>
          <div className={`tab ${tab === "billing" ? "active" : ""}`} onClick={() => setTab("billing")}>
            Billing
          </div>
          <div className={`tab ${tab === "change_orders" ? "active" : ""}`} onClick={() => setTab("change_orders")}>
            Change Orders
          </div>
          <div className={`tab ${tab === "contracts" ? "active" : ""}`} onClick={() => setTab("contracts")}>
            Contracts
          </div>
        </div>

        {tab === "overview" && (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                marginBottom: 24
              }}
            >
              <Metric label="Original Contract" value={fmtUSD(project.contractValue)} />
              <Metric
                label="Adjusted Contract"
                value={fmtUSD(project.adjustedContractValue)}
                hint={
                  project.coApprovedTotal
                    ? `+${fmtUSD(project.coApprovedTotal)} approved COs`
                    : undefined
                }
              />
              <Metric label="Billed To Date" value={fmtUSD(metrics.totalBilledToDate)} />
              <Metric
                label="% Complete"
                value={fmtPct(metrics.pctComplete)}
                hint={`${fmtUSD(metrics.balanceToFinish)} balance`}
              />
            </section>
            <section className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginTop: 0 }}>Project Info</h3>
              <Row label="Project #">{project.projectNumber}</Row>
              <Row label="Client">{project.client}</Row>
              <Row label="Project Manager">{project.pm.name} ({project.pm.email})</Row>
              <Row label="Start Date">{fmtDate(project.startDate)}</Row>
              <Row label="End Date">{project.endDate ? fmtDate(project.endDate) : "—"}</Row>
            </section>
            <section className="card">
              <h3 style={{ marginTop: 0 }}>Subcontractor Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Sub</th>
                    <th className="num">Contract</th>
                    <th className="num">Billed To Date</th>
                    <th className="num">% Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {subBreakdown.map((r: any) => (
                    <tr key={r.contractId}>
                      <td>{r.subName}</td>
                      <td className="num">{fmtUSD(r.contractValue)}</td>
                      <td className="num">{fmtUSD(r.billedToDate)}</td>
                      <td className="num">{fmtPct(r.pctComplete)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === "billing" && (
          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Billing Periods</h3>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  className="btn"
                  href={`/api/export/project/${project.id}/master?format=pdf`}
                  target="_blank"
                >
                  Master G703 (PDF)
                </a>
                <a
                  className="btn"
                  href={`/api/export/project/${project.id}/master?format=xlsx`}
                  target="_blank"
                >
                  Master G703 (XLSX)
                </a>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sub</th>
                  <th>Period</th>
                  <th className="num">Amount This Period</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {billingPeriods.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--text-muted)", textAlign: "center" }}>
                      No billing periods yet
                    </td>
                  </tr>
                )}
                {billingPeriods.map((bp: any) => (
                  <tr key={bp.id}>
                    <td>{bp.sub.companyName || bp.sub.name}</td>
                    <td>{monthName(bp.periodMonth)} {bp.periodYear}</td>
                    <td className="num">{fmtUSD(bp.periodTotal)}</td>
                    <td>{bp.submittedAt ? fmtDate(bp.submittedAt) : "—"}</td>
                    <td><StatusBadge status={bp.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn" onClick={() => setReviewingPeriod(bp.id)}>
                        {bp.status === "submitted" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "change_orders" && (
          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Change Orders</h3>
              <button className="btn btn-primary" onClick={() => setCoFormOpen(true)}>
                + Add Change Order
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>CO #</th>
                  <th>Description</th>
                  <th>Initiated By</th>
                  <th className="num">Amount</th>
                  <th className="num">Time Impact</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--text-muted)", textAlign: "center" }}>
                      No change orders yet
                    </td>
                  </tr>
                )}
                {changeOrders.map((co: any) => (
                  <tr key={co.id}>
                    <td className="mono">{co.coNumber}</td>
                    <td>{co.description}</td>
                    <td>
                      {co.initiatedBy} ({co.initiator.name})
                    </td>
                    <td className="num">{fmtUSD(co.amount)}</td>
                    <td className="num">
                      {co.timeImpact != null ? `${co.timeImpact} days` : "—"}
                    </td>
                    <td><StatusBadge status={co.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      {co.status === "pending" && (
                        <>
                          <button
                            className="btn btn-success"
                            onClick={() => coAction(co.id, "pm-approve")}
                            style={{ marginRight: 6 }}
                          >
                            PM Approve
                          </button>
                          <button className="btn btn-danger" onClick={() => coAction(co.id, "pm-reject")}>
                            Reject
                          </button>
                        </>
                      )}
                      {co.status === "pm_approved" && (
                        <button
                          className="btn btn-success"
                          onClick={() => coAction(co.id, "customer-approve")}
                        >
                          Mark Customer Approved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "contracts" && (
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Subcontractor Contracts</h3>
            <table>
              <thead>
                <tr>
                  <th>Sub</th>
                  <th>Description</th>
                  <th className="num">Contract Value</th>
                  <th className="num">Line Items</th>
                  <th>Assigned</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any) => (
                  <>
                    <tr key={c.id}>
                      <td>{c.subName}</td>
                      <td>{c.description}</td>
                      <td className="num">{fmtUSD(c.contractValue)}</td>
                      <td className="num">{c.lineItemCount}</td>
                      <td>{fmtDate(c.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn"
                          onClick={() =>
                            setExpandedContract(expandedContract === c.id ? null : c.id)
                          }
                        >
                          {expandedContract === c.id ? "Hide" : "Line Items"}
                        </button>
                      </td>
                    </tr>
                    {expandedContract === c.id && (
                      <tr key={c.id + "-items"}>
                        <td colSpan={6} style={{ background: "var(--bg-secondary)" }}>
                          <table>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Description</th>
                                <th>Type</th>
                                <th>Unit</th>
                                <th className="num">Unit $</th>
                                <th className="num">Qty</th>
                                <th className="num">Scheduled</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.lineItems.map((li: any) => (
                                <tr key={li.id}>
                                  <td className="mono">{li.itemNumber}</td>
                                  <td>{li.description}</td>
                                  <td>{li.contractType === "lump_sum" ? "Lump Sum" : "Unit Price"}</td>
                                  <td>{li.unit || "-"}</td>
                                  <td className="num">{li.unitPrice != null ? fmtUSD(li.unitPrice) : "-"}</td>
                                  <td className="num">{li.scheduledQty != null ? fmtQty(li.scheduledQty) : "-"}</td>
                                  <td className="num">{fmtUSD(li.scheduledValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {reviewingPeriod && (
        <BillingReviewModal
          periodId={reviewingPeriod}
          onClose={() => setReviewingPeriod(null)}
          onChange={load}
        />
      )}
      {coFormOpen && (
        <ChangeOrderForm
          projectId={project.id}
          onClose={() => setCoFormOpen(false)}
          onSaved={load}
          allowInitiatedBy
        />
      )}
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22 }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13
      }}
    >
      <div style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString();
}
function monthName(m: number) {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ][m - 1];
}
