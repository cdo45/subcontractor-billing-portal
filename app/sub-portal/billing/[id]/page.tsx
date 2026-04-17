"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useSessionWithRole } from "@/lib/useSession";
import Header from "@/components/Header";
import StatusBadge from "@/components/StatusBadge";
import ChangeOrderForm from "@/components/ChangeOrderForm";
import { fmtUSD, fmtPct, fmtQty, computeBillingValues } from "@/lib/calc";

export default function SubBillingEntryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const session = useSessionWithRole(["subcontractor"]);
  const [period, setPeriod] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const r = await api<any>(`/api/billing/period/${params.id}`);
    if (r.data) {
      setPeriod(r.data);
      setLineItems(r.data.lineItems);
      setNotes(r.data.notes || "");
    }
  }

  useEffect(() => {
    if (!session) return;
    load();
  }, [session, params.id]);

  function updateRow(id: string, patch: any) {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const merged = { ...li, ...patch };
        const computed = computeBillingValues(
          {
            contractType: li.contractType,
            scheduledValue: li.scheduledValue,
            unitPrice: li.unitPrice,
            scheduledQty: li.scheduledQty
          },
          {
            percentComplete: merged.percentComplete,
            qtyThisPeriod: merged.qtyThisPeriod,
            qtyCumulative: merged.qtyCumulative,
            previousCumulative: merged.previousCumulative
          }
        );
        return {
          ...merged,
          valueThisPeriod: computed.valueThisPeriod,
          valueCumulative: computed.valueCumulative,
          balanceToFinish: computed.balanceToFinish
        };
      })
    );
  }

  async function save(andSubmit = false) {
    andSubmit ? setSubmitting(true) : setSaving(true);
    setMessage(null);
    const r = await api(`/api/billing/period/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        notes,
        lineItems: lineItems.map((li) => ({
          lineItemId: li.lineItemId,
          percentComplete: li.contractType === "lump_sum" ? Number(li.percentComplete || 0) : undefined,
          qtyThisPeriod: li.contractType === "unit_price" ? Number(li.qtyThisPeriod || 0) : undefined,
          qtyCumulative: li.contractType === "unit_price" ? Number(li.qtyCumulative || 0) : undefined
        }))
      })
    });
    if (r.error) {
      setMessage(r.error);
      setSaving(false);
      setSubmitting(false);
      return;
    }
    if (andSubmit) {
      const sub = await api(`/api/billing/period/${params.id}/submit`, { method: "POST" });
      if (sub.error) {
        setMessage(sub.error);
        setSubmitting(false);
        return;
      }
      setMessage("Submitted for approval");
      setSubmitting(false);
      load();
      return;
    }
    setMessage("Draft saved");
    setSaving(false);
    load();
  }

  if (!period) {
    return (
      <>
        <Header />
        <main style={{ padding: 24 }}>Loading…</main>
      </>
    );
  }

  const readOnly = period.status !== "draft" && period.status !== "rejected";
  const periodTotal = lineItems.reduce((s, li) => s + Number(li.valueThisPeriod || 0), 0);
  const cumulativeTotal = lineItems.reduce((s, li) => s + Number(li.valueCumulative || 0), 0);

  return (
    <>
      <Header />
      <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          {period.project.projectNumber} — {period.project.client}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <h1 style={{ margin: 0 }}>
            {period.project.name} — {monthName(period.periodMonth)} {period.periodYear}
          </h1>
          <StatusBadge status={period.status} />
        </div>

        {readOnly && (
          <div
            className="card"
            style={{
              borderLeft: "2px solid var(--info)",
              marginBottom: 18,
              fontSize: 13
            }}
          >
            This billing is <strong>{period.status}</strong> — values are locked.
            {period.approvals?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {period.approvals.map((a: any) => (
                  <div key={a.id} style={{ color: "var(--text-secondary)" }}>
                    {a.approver.name}: {a.decision}
                    {a.comments ? ` — "${a.comments}"` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Type</th>
                <th className="num">Scheduled</th>
                <th className="num">Prev Cum</th>
                <th className="num">This Period</th>
                <th className="num">Cumulative</th>
                <th className="num">This Period $</th>
                <th className="num">Cumulative $</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="mono">{li.itemNumber}</td>
                  <td>{li.description}</td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {li.contractType === "lump_sum" ? "LS" : `${li.unit} @ ${fmtUSD(li.unitPrice || 0)}`}
                  </td>
                  <td className="num">{fmtUSD(li.scheduledValue)}</td>
                  <td className="num">{fmtUSD(li.previousCumulative)}</td>
                  <td className="num">
                    {li.contractType === "lump_sum" ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={readOnly}
                        value={li.percentComplete ?? 0}
                        onChange={(e) =>
                          updateRow(li.id, { percentComplete: Number(e.target.value) })
                        }
                        style={{ width: 80, textAlign: "right" }}
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={readOnly}
                        value={li.qtyThisPeriod ?? 0}
                        onChange={(e) =>
                          updateRow(li.id, {
                            qtyThisPeriod: Number(e.target.value),
                            qtyCumulative:
                              Number(li.previousQtyCumulative || 0) + Number(e.target.value)
                          })
                        }
                        style={{ width: 100, textAlign: "right" }}
                      />
                    )}
                  </td>
                  <td className="num">
                    {li.contractType === "lump_sum"
                      ? fmtPct(li.percentComplete)
                      : fmtQty(li.qtyCumulative)}
                  </td>
                  <td className="num">{fmtUSD(li.valueThisPeriod)}</td>
                  <td className="num">{fmtUSD(li.valueCumulative)}</td>
                  <td className="num">{fmtUSD(li.balanceToFinish)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={7}>TOTAL</td>
                <td className="num">{fmtUSD(periodTotal)}</td>
                <td className="num">{fmtUSD(cumulativeTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <label>Notes to PM</label>
          <textarea
            rows={3}
            value={notes}
            disabled={readOnly}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {message && (
          <div className="card" style={{ marginBottom: 18 }}>
            {message}
          </div>
        )}

        {!readOnly && (
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            <button className="btn" onClick={() => save(false)} disabled={saving}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => save(true)}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit for Approval"}
            </button>
          </div>
        )}

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Change Orders</h3>
            <button className="btn" onClick={() => setCoOpen(true)}>
              + Request Change Order
            </button>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Use this to request extras or credits. A PM will review and either approve
            or reject your request before forwarding to the customer.
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <a
            className="btn"
            href={`/api/export/billing/${params.id}?format=pdf`}
            target="_blank"
          >
            Export PDF
          </a>
          <a
            className="btn"
            href={`/api/export/billing/${params.id}?format=xlsx`}
            target="_blank"
          >
            Export XLSX
          </a>
          <a
            className="btn"
            href={`/api/export/billing/${params.id}?format=csv`}
            target="_blank"
          >
            Export CSV
          </a>
        </div>
      </main>

      {coOpen && (
        <ChangeOrderForm
          projectId={period.project.id}
          onClose={() => setCoOpen(false)}
          onSaved={() => load()}
        />
      )}
    </>
  );
}

function monthName(m: number) {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ][m - 1];
}
