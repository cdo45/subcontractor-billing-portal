import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser } from "@/lib/auth";
import { computeBillingValues } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadPeriodWithContext(id: string) {
  const bp = await prisma.billingPeriod.findUnique({
    where: { id },
    include: {
      project: true,
      sub: { select: { id: true, name: true, companyName: true, email: true } },
      lineItems: {
        include: { lineItem: true }
      },
      approvals: { include: { approver: { select: { id: true, name: true } } } }
    }
  });
  return bp;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const bp = await loadPeriodWithContext(params.id);
  if (!bp) return apiResponse(null, "Billing period not found", 404);
  if (user.role === "subcontractor" && bp.subId !== user.id)
    return apiResponse(null, "Forbidden", 403);

  // Lookup prior approved cumulative per line item for "previous %" display
  const priorApproved = await prisma.billingPeriod.findFirst({
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

  return apiResponse(
    {
      id: bp.id,
      projectId: bp.projectId,
      contractId: bp.contractId,
      sub: bp.sub,
      project: {
        id: bp.project.id,
        name: bp.project.name,
        projectNumber: bp.project.projectNumber,
        client: bp.project.client
      },
      periodMonth: bp.periodMonth,
      periodYear: bp.periodYear,
      status: bp.status,
      submittedAt: bp.submittedAt,
      notes: bp.notes,
      lineItems: bp.lineItems.map((bli) => {
        const prior = priorApproved?.lineItems.find((p) => p.lineItemId === bli.lineItemId);
        return {
          id: bli.id,
          lineItemId: bli.lineItemId,
          itemNumber: bli.lineItem.itemNumber,
          description: bli.lineItem.description,
          contractType: bli.lineItem.contractType,
          unit: bli.lineItem.unit,
          unitPrice: bli.lineItem.unitPrice ? Number(bli.lineItem.unitPrice) : null,
          scheduledQty: bli.lineItem.scheduledQty
            ? Number(bli.lineItem.scheduledQty)
            : null,
          scheduledValue: Number(bli.lineItem.scheduledValue),
          percentComplete: bli.percentComplete ? Number(bli.percentComplete) : 0,
          qtyThisPeriod: bli.qtyThisPeriod ? Number(bli.qtyThisPeriod) : 0,
          qtyCumulative: bli.qtyCumulative ? Number(bli.qtyCumulative) : 0,
          valueThisPeriod: Number(bli.valueThisPeriod),
          valueCumulative: Number(bli.valueCumulative),
          balanceToFinish: Number(bli.balanceToFinish),
          previousCumulative: prior ? Number(prior.valueCumulative) : 0,
          previousPercentComplete: prior ? Number(prior.percentComplete || 0) : 0,
          previousQtyCumulative: prior ? Number(prior.qtyCumulative || 0) : 0
        };
      }),
      approvals: bp.approvals.map((a) => ({
        id: a.id,
        approver: a.approver,
        decision: a.decision,
        comments: a.comments,
        createdAt: a.createdAt
      })),
      periodTotal: bp.lineItems.reduce((s, li) => s + Number(li.valueThisPeriod), 0),
      cumulativeTotal: bp.lineItems.reduce(
        (s, li) => s + Number(li.valueCumulative),
        0
      )
    },
    null,
    200
  );
}

// Sub updates line item values while period is in draft
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const bp = await prisma.billingPeriod.findUnique({
    where: { id: params.id },
    include: { lineItems: { include: { lineItem: true } } }
  });
  if (!bp) return apiResponse(null, "Billing period not found", 404);
  if (user.role !== "subcontractor" || bp.subId !== user.id)
    return apiResponse(null, "Forbidden", 403);
  if (bp.status !== "draft" && bp.status !== "rejected")
    return apiResponse(null, "Cannot edit a " + bp.status + " billing period", 409);

  try {
    const body = await request.json();
    const updates: Array<{
      lineItemId: string;
      percentComplete?: number;
      qtyThisPeriod?: number;
      qtyCumulative?: number;
    }> = body.lineItems || [];
    const notes: string | undefined = body.notes;

    // Find prior approved period cumulative for "previous" baseline
    const priorApproved = await prisma.billingPeriod.findFirst({
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

    for (const u of updates) {
      const bli = bp.lineItems.find((b) => b.lineItemId === u.lineItemId);
      if (!bli) continue;
      const prior = priorApproved?.lineItems.find((p) => p.lineItemId === u.lineItemId);
      const previousCumulative = prior ? Number(prior.valueCumulative) : 0;
      const computed = computeBillingValues(
        {
          contractType: bli.lineItem.contractType,
          scheduledValue: Number(bli.lineItem.scheduledValue),
          unitPrice: bli.lineItem.unitPrice ? Number(bli.lineItem.unitPrice) : null,
          scheduledQty: bli.lineItem.scheduledQty ? Number(bli.lineItem.scheduledQty) : null
        },
        {
          percentComplete: u.percentComplete,
          qtyThisPeriod: u.qtyThisPeriod,
          qtyCumulative: u.qtyCumulative,
          previousCumulative
        }
      );

      await prisma.billingLineItem.update({
        where: { id: bli.id },
        data: {
          percentComplete:
            bli.lineItem.contractType === "lump_sum" ? u.percentComplete ?? 0 : null,
          qtyThisPeriod:
            bli.lineItem.contractType === "unit_price" ? u.qtyThisPeriod ?? 0 : null,
          qtyCumulative:
            bli.lineItem.contractType === "unit_price" ? u.qtyCumulative ?? 0 : null,
          valueThisPeriod: computed.valueThisPeriod,
          valueCumulative: computed.valueCumulative,
          balanceToFinish: computed.balanceToFinish
        }
      });
    }

    if (notes !== undefined) {
      await prisma.billingPeriod.update({
        where: { id: bp.id },
        data: { notes, status: bp.status === "rejected" ? "draft" : bp.status }
      });
    }

    return apiResponse({ updated: updates.length }, null, 200);
  } catch (e: any) {
    return apiResponse(null, e.message || "Update failed", 500);
  }
}
