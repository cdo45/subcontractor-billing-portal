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

  const bp = await prisma.billingPeriod.findUnique({ where: { id: params.id } });
  if (!bp) return apiResponse(null, "Billing period not found", 404);
  if (bp.status !== "submitted")
    return apiResponse(null, "Can only reject submitted billing periods", 409);

  const body = await request.json().catch(() => ({}));
  const comments: string | undefined = body?.comments;
  if (!comments || !comments.trim())
    return apiResponse(null, "Rejection requires comments", 400);

  const updated = await prisma.billingPeriod.update({
    where: { id: bp.id },
    data: { status: "rejected" }
  });
  await prisma.approval.create({
    data: {
      approverId: user!.id,
      entityType: "billing_period",
      billingPeriodId: bp.id,
      decision: "rejected",
      comments
    }
  });
  return apiResponse(updated, null, 200);
}
