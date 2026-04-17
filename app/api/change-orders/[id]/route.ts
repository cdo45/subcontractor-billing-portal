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

  const co = await prisma.changeOrder.findUnique({
    where: { id: params.id },
    include: {
      initiator: { select: { id: true, name: true, role: true, companyName: true } },
      approvals: { include: { approver: { select: { id: true, name: true } } } }
    }
  });
  if (!co) return apiResponse(null, "Change order not found", 404);
  return apiResponse(co, null, 200);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const co = await prisma.changeOrder.findUnique({ where: { id: params.id } });
  if (!co) return apiResponse(null, "Change order not found", 404);
  if (co.status !== "pending")
    return apiResponse(null, "Can only edit pending change orders", 409);
  if (user.role === "subcontractor" && co.initiatorId !== user.id)
    return apiResponse(null, "Forbidden", 403);

  try {
    const body = await request.json();
    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.timeImpact !== undefined) data.timeImpact = body.timeImpact;
    if (body.timeImpactNote !== undefined) data.timeImpactNote = body.timeImpactNote;
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await prisma.changeOrder.update({ where: { id: co.id }, data });
    return apiResponse(updated, null, 200);
  } catch (e: any) {
    return apiResponse(null, e.message || "Update failed", 500);
  }
}
