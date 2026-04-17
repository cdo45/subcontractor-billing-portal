import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const projects = await prisma.project.findMany({
    include: {
      contracts: true,
      changeOrders: { select: { status: true, amount: true } },
      billingPeriods: {
        include: { lineItems: { select: { valueThisPeriod: true, valueCumulative: true } } }
      }
    }
  });

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  let activeCount = 0;
  let completedCount = 0;
  let pendingApproval = 0;
  let pendingCOs = 0;
  let billedThisMonth = 0;
  let grandBilled = 0;

  const perProject = projects.map((p) => {
    if (p.status === "active") activeCount++;
    if (p.status === "completed") completedCount++;

    const projectBilledToDate = p.billingPeriods
      .filter((bp) => bp.status === "approved")
      .flatMap((bp) => bp.lineItems)
      .reduce((s, li) => s + Number(li.valueCumulative), 0);
    grandBilled += projectBilledToDate;

    const projectBilledThisMonth = p.billingPeriods
      .filter(
        (bp) =>
          bp.status === "approved" &&
          bp.periodMonth === thisMonth &&
          bp.periodYear === thisYear
      )
      .flatMap((bp) => bp.lineItems)
      .reduce((s, li) => s + Number(li.valueThisPeriod), 0);
    billedThisMonth += projectBilledThisMonth;

    pendingApproval += p.billingPeriods.filter((bp) => bp.status === "submitted").length;
    pendingCOs += p.changeOrders.filter((co) => co.status === "pending").length;

    const coApproved = p.changeOrders
      .filter((co) => co.status === "customer_approved")
      .reduce((s, co) => s + Number(co.amount), 0);
    const adjustedContract = Number(p.contractValue) + coApproved;

    return {
      id: p.id,
      projectNumber: p.projectNumber,
      name: p.name,
      client: p.client,
      status: p.status,
      contractValue: Number(p.contractValue),
      adjustedContractValue: adjustedContract,
      billedToDate: projectBilledToDate,
      pctComplete: adjustedContract > 0 ? (projectBilledToDate / adjustedContract) * 100 : 0
    };
  });

  return apiResponse(
    {
      metrics: {
        activeProjects: activeCount,
        completedProjects: completedCount,
        pendingApproval,
        pendingCOs,
        billedThisMonth,
        grandBilled
      },
      projects: perProject
    },
    null,
    200
  );
}
