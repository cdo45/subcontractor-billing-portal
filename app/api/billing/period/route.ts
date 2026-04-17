import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";
import { computeBillingValues } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Create a new draft billing period (sub only) for a given contract & month
export async function POST(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["subcontractor"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  try {
    const body = await request.json();
    const { contractId, periodMonth, periodYear, notes } = body;
    if (!contractId || !periodMonth || !periodYear) {
      return apiResponse(null, "Missing contractId/periodMonth/periodYear", 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { lineItems: { orderBy: { itemNumber: "asc" } } }
    });
    if (!contract) return apiResponse(null, "Contract not found", 404);
    if (contract.subId !== user!.id) return apiResponse(null, "Forbidden", 403);

    // Check no draft already exists for this contract & period
    const existing = await prisma.billingPeriod.findFirst({
      where: {
        contractId,
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        status: { in: ["draft", "submitted"] }
      }
    });
    if (existing)
      return apiResponse(
        null,
        `A ${existing.status} billing already exists for this period`,
        409
      );

    // Pre-populate line items with prior cumulative values from last approved period
    const priorApproved = await prisma.billingPeriod.findFirst({
      where: {
        contractId,
        status: "approved"
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: { lineItems: true }
    });

    const bp = await prisma.billingPeriod.create({
      data: {
        projectId: contract.projectId,
        contractId: contract.id,
        subId: user!.id,
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        notes: notes || null,
        status: "draft",
        lineItems: {
          create: contract.lineItems.map((li) => {
            const prior = priorApproved?.lineItems.find((b) => b.lineItemId === li.id);
            const priorCumValue = prior ? Number(prior.valueCumulative) : 0;
            const priorCumQty = prior ? Number(prior.qtyCumulative || 0) : 0;
            const priorPct = prior ? Number(prior.percentComplete || 0) : 0;

            // Seed new period with prior cumulative values, zero new activity
            if (li.contractType === "lump_sum") {
              return {
                lineItemId: li.id,
                percentComplete: priorPct,
                valueThisPeriod: 0,
                valueCumulative: priorCumValue,
                balanceToFinish: Number(li.scheduledValue) - priorCumValue
              };
            }
            // unit_price
            return {
              lineItemId: li.id,
              qtyThisPeriod: 0,
              qtyCumulative: priorCumQty,
              valueThisPeriod: 0,
              valueCumulative: priorCumValue,
              balanceToFinish: Number(li.scheduledValue) - priorCumValue
            };
          })
        }
      },
      include: { lineItems: true }
    });

    return apiResponse(bp, null, 201);
  } catch (e: any) {
    return apiResponse(null, e.message || "Failed to create billing period", 500);
  }
}
