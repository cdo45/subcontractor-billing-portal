import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns all contracts assigned to the current sub, with current billing status
export async function GET(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["subcontractor"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const contracts = await prisma.contract.findMany({
    where: { subId: user!.id },
    include: {
      project: true,
      lineItems: true
    }
  });

  const billingPeriods = await prisma.billingPeriod.findMany({
    where: { subId: user!.id },
    include: { lineItems: true }
  });

  const enriched = contracts.map((c) => {
    const myBPs = billingPeriods.filter((bp) => bp.contractId === c.id);
    const billedToDate = myBPs
      .filter((bp) => bp.status === "approved")
      .flatMap((bp) => bp.lineItems)
      .reduce((s, li) => s + Number(li.valueCumulative), 0);
    const cv = Number(c.contractValue);
    return {
      contractId: c.id,
      projectId: c.project.id,
      projectNumber: c.project.projectNumber,
      projectName: c.project.name,
      client: c.project.client,
      contractValue: cv,
      billedToDate,
      pctComplete: cv > 0 ? (billedToDate / cv) * 100 : 0,
      description: c.description,
      billingPeriods: myBPs
        .map((bp) => ({
          id: bp.id,
          periodMonth: bp.periodMonth,
          periodYear: bp.periodYear,
          status: bp.status,
          submittedAt: bp.submittedAt,
          periodTotal: bp.lineItems.reduce(
            (s, li) => s + Number(li.valueThisPeriod),
            0
          )
        }))
        .sort(
          (a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth
        )
    };
  });

  return apiResponse(enriched, null, 200);
}
