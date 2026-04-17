import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pm: { select: { id: true, name: true, email: true } },
      contracts: { select: { id: true, contractValue: true } },
      changeOrders: {
        select: { id: true, status: true, amount: true }
      },
      billingPeriods: {
        select: { id: true, status: true, lineItems: { select: { valueCumulative: true } } }
      }
    }
  });

  const enriched = projects.map((p) => {
    const coApprovedTotal = p.changeOrders
      .filter((co) => co.status === "customer_approved")
      .reduce((sum, co) => sum + Number(co.amount), 0);
    const billedToDate = p.billingPeriods
      .filter((bp) => bp.status === "approved")
      .flatMap((bp) => bp.lineItems)
      .reduce((sum, li) => sum + Number(li.valueCumulative), 0);
    const pendingBillings = p.billingPeriods.filter((bp) => bp.status === "submitted").length;
    const pendingCOs = p.changeOrders.filter((co) => co.status === "pending").length;
    const adjustedContractValue = Number(p.contractValue) + coApprovedTotal;
    const pctComplete =
      adjustedContractValue > 0 ? (billedToDate / adjustedContractValue) * 100 : 0;

    return {
      id: p.id,
      projectNumber: p.projectNumber,
      name: p.name,
      client: p.client,
      contractValue: Number(p.contractValue),
      adjustedContractValue,
      billedToDate,
      pctComplete,
      pendingBillings,
      pendingCOs,
      status: p.status,
      pm: p.pm,
      startDate: p.startDate,
      endDate: p.endDate
    };
  });

  return apiResponse(enriched, null, 200);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  try {
    const body = await request.json();
    const { projectNumber, name, client, contractValue, startDate, endDate, pmId } = body;
    if (!projectNumber || !name || !client || !contractValue || !startDate || !pmId) {
      return apiResponse(null, "Missing required fields", 400);
    }
    const proj = await prisma.project.create({
      data: {
        projectNumber,
        name,
        client,
        contractValue,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        pmId
      }
    });
    return apiResponse(proj, null, 201);
  } catch (e: any) {
    return apiResponse(null, e.message || "Failed to create project", 500);
  }
}
