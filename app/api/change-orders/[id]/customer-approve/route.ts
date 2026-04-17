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
  if (co.status !== "pm_approved")
    return apiResponse(null, "CO must be pm_approved before customer approval", 409);

  const updated = await prisma.changeOrder.update({
    where: { id: co.id },
    data: { status: "customer_approved", customerApprovedAt: new Date() }
  });
  await prisma.approval.create({
    data: {
      approverId: user!.id,
      entityType: "change_order",
      changeOrderId: co.id,
      decision: "approved",
      comments: "Customer approval confirmed"
    }
  });
  return apiResponse(updated, null, 200);
}
