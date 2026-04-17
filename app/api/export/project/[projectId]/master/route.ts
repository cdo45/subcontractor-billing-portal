import { prisma } from "@/lib/db";
import { getSessionUser, requireRole } from "@/lib/auth";
import { generatePDF, generateXLSX, generateCSV, G703Row, G703Header } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Master G703 across all subs on a project for a given month/year (or all periods)
export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return new Response(check.error, { status: check.status });

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "pdf").toLowerCase();
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      contracts: {
        include: {
          sub: true,
          lineItems: true
        }
      },
      changeOrders: true
    }
  });
  if (!project) return new Response("Not found", { status: 404 });

  const bpFilter: any = {
    projectId: project.id,
    status: { in: ["approved", "submitted"] }
  };
  if (month && year) {
    bpFilter.periodMonth = Number(month);
    bpFilter.periodYear = Number(year);
  }
  const billingPeriods = await prisma.billingPeriod.findMany({
    where: bpFilter,
    include: { lineItems: true, sub: true }
  });

  // Flatten each contract line item + roll-up numbers across all BPs
  const rows: G703Row[] = [];
  for (const contract of project.contracts) {
    for (const li of contract.lineItems.sort((a, b) =>
      a.itemNumber.localeCompare(b.itemNumber)
    )) {
      let valueThisPeriod = 0;
      let valueCumulative = 0;
      let qtyThis = 0;
      let qtyCum = 0;
      for (const bp of billingPeriods.filter((b) => b.contractId === contract.id)) {
        for (const bli of bp.lineItems.filter((b) => b.lineItemId === li.id)) {
          valueThisPeriod += Number(bli.valueThisPeriod);
          if (Number(bli.valueCumulative) > valueCumulative) {
            valueCumulative = Number(bli.valueCumulative);
            qtyCum = Number(bli.qtyCumulative || 0);
          }
          qtyThis += Number(bli.qtyThisPeriod || 0);
        }
      }
      const sv = Number(li.scheduledValue);
      rows.push({
        itemNumber: `${contract.sub.companyName || contract.sub.name} / ${li.itemNumber}`,
        description: li.description,
        contractType: li.contractType,
        unit: li.unit,
        unitPrice: li.unitPrice ? Number(li.unitPrice) : null,
        scheduledQty: li.scheduledQty ? Number(li.scheduledQty) : null,
        scheduledValue: sv,
        previousCumulative: valueCumulative - valueThisPeriod,
        qtyThisPeriod: qtyThis || undefined,
        qtyCumulative: qtyCum || undefined,
        percentComplete: sv > 0 ? (valueCumulative / sv) * 100 : 0,
        valueThisPeriod,
        valueCumulative,
        balanceToFinish: sv - valueCumulative
      });
    }
  }

  const periodLabel =
    month && year
      ? `${MONTHS[Number(month) - 1]} ${year}`
      : "All Periods (Master)";

  const header: G703Header = {
    projectNumber: project.projectNumber,
    projectName: project.name,
    client: project.client,
    subcontractor: "ALL SUBCONTRACTORS",
    period: periodLabel,
    contractValue: Number(project.contractValue)
  };

  const filenameBase = `${project.projectNumber}-master-${periodLabel.replace(/\s+/g, "_")}`.replace(/[^A-Za-z0-9_-]/g, "_");

  const changeOrders = project.changeOrders.map((co) => ({
    coNumber: co.coNumber,
    description: co.description,
    amount: Number(co.amount),
    status: co.status
  }));

  if (format === "pdf") {
    const buf = generatePDF(header, rows, changeOrders);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`
      }
    });
  }
  if (format === "xlsx") {
    const buf = generateXLSX(header, rows, changeOrders);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`
      }
    });
  }
  if (format === "csv") {
    const csv = generateCSV(header, rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`
      }
    });
  }
  return new Response("Unknown format", { status: 400 });
}
