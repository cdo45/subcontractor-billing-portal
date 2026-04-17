import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { generatePDF, generateXLSX, generateCSV, G703Row, G703Header } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function GET(
  request: Request,
  { params }: { params: { periodId: string } }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "pdf").toLowerCase();

  const bp = await prisma.billingPeriod.findUnique({
    where: { id: params.periodId },
    include: {
      project: true,
      sub: true,
      lineItems: { include: { lineItem: true } }
    }
  });
  if (!bp) return new Response("Not found", { status: 404 });
  if (user.role === "subcontractor" && bp.subId !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Prior approved cumulative
  const prior = await prisma.billingPeriod.findFirst({
    where: {
      contractId: bp.contractId,
      status: "approved",
      OR: [
        { periodYear: { lt: bp.periodYear } },
        { periodYear: bp.periodYear, periodMonth: { lt: bp.periodMonth } }
      ]
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: { lineItems: true }
  });

  const rows: G703Row[] = bp.lineItems
    .sort((a, b) => a.lineItem.itemNumber.localeCompare(b.lineItem.itemNumber))
    .map((bli) => {
      const priorBli = prior?.lineItems.find((p) => p.lineItemId === bli.lineItemId);
      return {
        itemNumber: bli.lineItem.itemNumber,
        description: bli.lineItem.description,
        contractType: bli.lineItem.contractType,
        unit: bli.lineItem.unit,
        unitPrice: bli.lineItem.unitPrice ? Number(bli.lineItem.unitPrice) : null,
        scheduledQty: bli.lineItem.scheduledQty
          ? Number(bli.lineItem.scheduledQty)
          : null,
        scheduledValue: Number(bli.lineItem.scheduledValue),
        previousCumulative: priorBli ? Number(priorBli.valueCumulative) : 0,
        qtyThisPeriod: bli.qtyThisPeriod ? Number(bli.qtyThisPeriod) : undefined,
        qtyCumulative: bli.qtyCumulative ? Number(bli.qtyCumulative) : undefined,
        percentComplete: bli.percentComplete ? Number(bli.percentComplete) : undefined,
        valueThisPeriod: Number(bli.valueThisPeriod),
        valueCumulative: Number(bli.valueCumulative),
        balanceToFinish: Number(bli.balanceToFinish)
      };
    });

  const header: G703Header = {
    projectNumber: bp.project.projectNumber,
    projectName: bp.project.name,
    client: bp.project.client,
    subcontractor: bp.sub.companyName || bp.sub.name,
    period: `${MONTHS[bp.periodMonth - 1]} ${bp.periodYear}`
  };

  const filenameBase = `${bp.project.projectNumber}-${bp.sub.companyName || bp.sub.name}-${bp.periodYear}-${String(bp.periodMonth).padStart(2, "0")}`.replace(/[^A-Za-z0-9-]/g, "_");

  if (format === "pdf") {
    const buf = generatePDF(header, rows);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`
      }
    });
  }
  if (format === "xlsx") {
    const buf = generateXLSX(header, rows);
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
