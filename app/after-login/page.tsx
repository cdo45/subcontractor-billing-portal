import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AfterLoginPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as any)?.role as string | undefined;

  if (role === "subcontractor") redirect("/sub-portal");
  // Default: PM / admin / unknown
  redirect("/dashboard");
}
