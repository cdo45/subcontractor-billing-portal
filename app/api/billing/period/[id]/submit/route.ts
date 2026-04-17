import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);

  const bp = await prisma.billingPeriod.findUnique({ where: { id: params.id } });
  if (!bp) return apiResponse(null, "Billing period not found", 404);
  if (user.role !== "subcontractor" || bp.subId !== user.id)
    return apiResponse(null, "Forbidden", 403);
  if (bp.status !== "draft" && bp.status !== "rejected")
    return apiResponse(null, "Cannot submit a " + bp.status + " billing period", 409);

  const updated = await prisma.billingPeriod.update({
    where: { id: bp.id },
    data: { status: "submitted", submittedAt: new Date() }
  });
  return apiResponse(updated, null, 200);
}
