import { getSessionUser, apiResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiResponse(null, "Unauthorized", 401);
  return apiResponse({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyName: user.companyName
  }, null, 200);
}
