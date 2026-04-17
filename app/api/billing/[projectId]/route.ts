import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const where: any = { projectId: params.projectId };
  if (user.role === "subcontractor") where.subId = user.id;

  const periods = await prisma.billingPeriod.findMany({
    where,
    include: {
      sub: { select: { id: true, name: true, companyName: true } },
      lineItems: true
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }]
  });

  return apiResponse(
    periods.map((bp) => ({
      id: bp.id,
      contractId: bp.contractId,
      sub: bp.sub,
      periodMonth: bp.periodMonth,
      periodYear: bp.periodYear,
      status: bp.status,
      submittedAt: bp.submittedAt,
      periodTotal: bp.lineItems.reduce((s, li) => s + Number(li.valueThisPeriod), 0),
      cumulativeTotal: bp.lineItems.reduce(
        (s, li) => s + Number(li.valueCumulative),
        0
      ),
      notes: bp.notes
    })),
    null,
    200
  );
}
