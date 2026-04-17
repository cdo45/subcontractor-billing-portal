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

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { lineItems: { orderBy: { itemNumber: "asc" } } }
  });
  if (!contract) return apiResponse(null, "Contract not found", 404);

  // Subs can only view their own contract
  if (user.role === "subcontractor" && contract.subId !== user.id) {
    return apiResponse(null, "Forbidden", 403);
  }

  return apiResponse(
    contract.lineItems.map((li) => ({
      id: li.id,
      itemNumber: li.itemNumber,
      description: li.description,
      contractType: li.contractType,
      unit: li.unit,
      unitPrice: li.unitPrice ? Number(li.unitPrice) : null,
      scheduledQty: li.scheduledQty ? Number(li.scheduledQty) : null,
      scheduledValue: Number(li.scheduledValue)
    })),
    null,
    200
  );
}
