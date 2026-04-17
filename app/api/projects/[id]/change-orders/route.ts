import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const where: any = { projectId: params.id };
  // Subs only see COs they initiated
  if (user.role === "subcontractor") where.initiatorId = user.id;

  const cos = await prisma.changeOrder.findMany({
    where,
    include: {
      initiator: { select: { id: true, name: true, role: true, companyName: true } }
    },
    orderBy: { coNumber: "asc" }
  });
  return apiResponse(
    cos.map((co) => ({
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
    null,
    200
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  try {
    const body = await request.json();
    const { description, amount, timeImpact, timeImpactNote, initiatedBy, notes } = body;
    if (!description || amount == null)
      return apiResponse(null, "description and amount required", 400);

    // auto-increment CO number per project
    const count = await prisma.changeOrder.count({ where: { projectId: params.id } });
    const coNumber = "CO-" + String(count + 1).padStart(3, "0");

    let initiatedByFinal: string;
    if (user.role === "subcontractor") initiatedByFinal = "sub";
    else initiatedByFinal = initiatedBy === "customer" ? "customer" : "pm";

    const co = await prisma.changeOrder.create({
      data: {
        projectId: params.id,
        coNumber,
        initiatedBy: initiatedByFinal,
        initiatorId: user.id,
        description,
        amount,
        timeImpact: timeImpact ?? null,
        timeImpactNote: timeImpactNote || null,
        notes: notes || null,
        status: "pending"
      }
    });
    return apiResponse(co, null, 201);
  } catch (e: any) {
    return apiResponse(null, e.message || "Failed to create change order", 500);
  }
}
