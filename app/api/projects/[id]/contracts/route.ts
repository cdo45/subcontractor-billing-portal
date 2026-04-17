import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const contracts = await prisma.contract.findMany({
    where: { projectId: params.id },
    include: {
      sub: { select: { id: true, name: true, companyName: true } },
      lineItems: true
    }
  });
  return apiResponse(contracts, null, 200);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  try {
    const body = await request.json();
    const { subId, contractValue, description, lineItems } = body;
    if (!subId || !contractValue || !description || !Array.isArray(lineItems)) {
      return apiResponse(null, "Missing required fields", 400);
    }
    const contract = await prisma.contract.create({
      data: {
        projectId: params.id,
        subId,
        contractValue,
        description,
        lineItems: {
          create: lineItems.map((li: any) => ({
            itemNumber: li.itemNumber,
            description: li.description,
            contractType: li.contractType,
            unit: li.unit || null,
            unitPrice: li.unitPrice || null,
            scheduledQty: li.scheduledQty || null,
            scheduledValue: li.scheduledValue
          }))
        }
      },
      include: { lineItems: true }
    });
    return apiResponse(contract, null, 201);
  } catch (e: any) {
    return apiResponse(null, e.message || "Failed to create contract", 500);
  }
}
