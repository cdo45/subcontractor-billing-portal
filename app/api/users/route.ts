import { prisma } from "@/lib/db";
import { apiResponse, getSessionUser, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  const check = requireRole(user, ["admin", "pm"]);
  if (!check.ok) return apiResponse(null, check.error!, check.status);

  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  const where: any = {};
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyName: true
    }
  });
  return apiResponse(users, null, 200);
}
