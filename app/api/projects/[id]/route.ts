import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const proj = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      pm: { select: { id: true, name: true, email: true } },
      contracts: {
        include: {
          sub: { select: { id: true, name: true, email: true, companyName: true } },
          lineItems: true
        }
      },
      changeOrders: {
        include: {
          initiator: { select: { id: true, name: true, role: true, companyName: true } }
        },
        orderBy: { coNumber: "asc" }
      },
      billingPeriods: {
        include: {
          sub: { select: { id: true, name: true, companyName: true } },
          lineItems: true
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }]
      }
    }
  });
  if (!proj) return apiResponse(null, "Project not found", 404);

  // Compute project-wide metrics
  const coApprovedTotal = proj.changeOrders
    .filter((co) => co.status === "customer_approved")
    .reduce((s, co) => s + Number(co.amount), 0);
  const adjustedContractValue = Number(proj.contractValue) + coApprovedTotal;

  // Per-sub breakdown
  const subBreakdown = proj.contracts.map((c) => {
    const bps = proj.billingPeriods.filter((bp) => bp.contractId === c.id && bp.status === "approved");
    const billedToDate = bps
      .flatMap((bp) => bp.lineItems)
      .reduce((s, li) => s + Number(li.valueCumulative), 0);
    const cv = Number(c.contractValue);
    return {
      contractId: c.id,
      subId: c.subId,
      subName: c.sub.companyName || c.sub.name,
      contractValue: cv,
      billedToDate,
      pctComplete: cv > 0 ? (billedToDate / cv) * 100 : 0
    };
  });

  const totalBilledToDate = subBreakdown.reduce((s, r) => s + r.billedToDate, 0);

  return apiResponse(
    {
      project: {
        id: proj.id,
        projectNumber: proj.projectNumber,
        name: proj.name,
        client: proj.client,
        contractValue: Number(proj.contractValue),
        adjustedContractValue,
        coApprovedTotal,
        startDate: proj.startDate,
        endDate: proj.endDate,
        status: proj.status,
        pm: proj.pm
      },
      metrics: {
        totalBilledToDate,
        pctComplete:
          adjustedContractValue > 0 ? (totalBilledToDate / adjustedContractValue) * 100 : 0,
        balanceToFinish: adjustedContractValue - totalBilledToDate,
        coApprovedTotal,
        coPendingCount: proj.changeOrders.filter((co) => co.status === "pending").length
      },
      subBreakdown,
      contracts: proj.contracts.map((c) => ({
        id: c.id,
        subId: c.subId,
        subName: c.sub.companyName || c.sub.name,
        contractValue: Number(c.contractValue),
        description: c.description,
        lineItemCount: c.lineItems.length,
        lineItems: c.lineItems.map((li) => ({
          id: li.id,
          itemNumber: li.itemNumber,
          description: li.description,
          contractType: li.contractType,
          unit: li.unit,
          unitPrice: li.unitPrice ? Number(li.unitPrice) : null,
          scheduledQty: li.scheduledQty ? Number(li.scheduledQty) : null,
          scheduledValue: Number(li.scheduledValue)
        })),
        createdAt: c.createdAt
      })),
      changeOrders: proj.changeOrders.map((co) => ({
        id: co.id,
        coNumber: co.coNumber,
        description: co.description,
        initiatedBy: co.initiatedBy,
        initiator: co.initiator,
        amount: Number(co.amount),
        timeImpact: co.timeImpact,
        timeImpactNote: co.timeImpactNote,
        status: co.status,
        customerApprovedAt: co.customerApprovedAt,
        notes: co.notes,
        createdAt: co.createdAt
      })),
      billingPeriods: proj.billingPeriods.map((bp) => {
        const periodTotal = bp.lineItems.reduce(
          (s, li) => s + Number(li.valueThisPeriod),
          0
        );
        return {
          id: bp.id,
          contractId: bp.contractId,
          subId: bp.subId,
          sub: bp.sub,
          periodMonth: bp.periodMonth,
          periodYear: bp.periodYear,
          status: bp.status,
          submittedAt: bp.submittedAt,
          periodTotal,
          notes: bp.notes
        };
      })
    },
    null,
    200
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  try {
    const body = await request.json();
    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.endDate !== undefined)
      data.endDate = body.endDate ? new Date(body.endDate) : null;
    const updated = await prisma.project.update({ where: { id: params.id }, data });
    return apiResponse(updated, null, 200);
  } catch (e: any) {
    return apiResponse(null, e.message || "Update failed", 500);
  }
}
