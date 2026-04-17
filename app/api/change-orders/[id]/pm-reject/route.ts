import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const co = await prisma.changeOrder.findUnique({ where: { id: params.id } });
  if (!co) return apiResponse(null, "Change order not found", 404);
  if (co.status !== "pending")
    return apiResponse(null, "Can only reject pending change orders", 409);

  const body = await request.json().catch(() => ({}));
  const comments: string | undefined = body?.comments;
  if (!comments || !comments.trim())
    return apiResponse(null, "Rejection requires comments", 400);

  const updated = await prisma.changeOrder.update({
    where: { id: co.id },
    data: { status: "rejected" }
  });
  await prisma.approval.create({
    data: {
      approverId: user!.id,
      entityType: "change_order",
      changeOrderId: co.id,
      decision: "rejected",
      comments
    }
  });
  return apiResponse(updated, null, 200);
}
