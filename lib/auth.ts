import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "./db";

export type Role = "admin" | "pm" | "subcontractor";

export interface ResolvedSessionUser {
  id: string; // Prisma User.id (used by all existing relations)
  clerkId: string;
  email: string;
  name: string;
  role: Role;
  companyName: string | null;
}

// Look up the Prisma user that corresponds to the current Clerk session.
// - Clerk is the source of truth for authentication and for the role
//   (set in publicMetadata.role during seed-clerk-users).
// - Prisma User.id is still the FK target used across the data model,
//   so we link via User.clerkId.
export async function getSessionUser(): Promise<ResolvedSessionUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Read role + optional prismaUserId from Clerk publicMetadata.
  let role: Role | null = null;
  let prismaUserId: string | null = null;
  let clerkEmail: string | null = null;
  let clerkName = "";

  try {
    const client = await clerkClient();
    const u = await client.users.getUser(clerkId);
    role = ((u.publicMetadata as any)?.role ?? null) as Role | null;
    prismaUserId = ((u.publicMetadata as any)?.prismaUserId ?? null) as string | null;
    clerkEmail =
      u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
      u.emailAddresses?.[0]?.emailAddress ||
      null;
    clerkName = [u.firstName, u.lastName].filter(Boolean).join(" ") || clerkEmail || "";
  } catch {
    // Clerk unreachable (e.g. bad keys in local dev) — treat as anonymous.
    return null;
  }

  if (!role) return null;

  // Prefer explicit Prisma id from publicMetadata; fall back to clerkId lookup.
  let user = prismaUserId
    ? await prisma.user.findUnique({ where: { id: prismaUserId } })
    : await prisma.user.findUnique({ where: { clerkId } });

  if (!user && clerkEmail) {
    // Last-resort fallback: match by email (useful the first time a user
    // signs in via Clerk before seed-clerk-users has linked them back).
    user = await prisma.user.findUnique({ where: { email: clerkEmail } });
    if (user && !user.clerkId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkId }
      });
    }
  }

  if (!user) return null;

  return {
    id: user.id,
    clerkId,
    email: user.email,
    name: user.name || clerkName,
    role,
    companyName: user.companyName
  };
}

export async function getUserRole(clerkId: string): Promise<Role | null> {
  const client = await clerkClient();
  const u = await client.users.getUser(clerkId);
  return ((u.publicMetadata as any)?.role ?? null) as Role | null;
}

export function requireRole(
  user: { role: string } | null,
  allowed: Role[]
): { ok: boolean; status: number; error?: string } {
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  if (!allowed.includes(user.role as Role))
    return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, status: 200 };
}

export function apiResponse<T>(
  data: T | null,
  error: string | null,
  status = 200
) {
  return Response.json({ data, error, status }, { status });
}
