/**
 * Seeds Clerk users that correspond to the Prisma users created by
 * prisma/seed.ts. Must be run AFTER `npx prisma db seed` so the Prisma
 * user records exist to link against.
 *
 * Requires these env vars (normally in .env.local):
 *   CLERK_SECRET_KEY       — Clerk backend API key (sk_test_... or sk_live_...)
 *   DATABASE_URL           — Neon Postgres connection string
 *
 * Usage:
 *   npx tsx scripts/seed-clerk-users.ts
 */

import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error("Missing CLERK_SECRET_KEY in environment.");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const prisma = new PrismaClient();

const SEED_PASSWORD = "Test1234!Vance"; // Clerk requires uppercase + symbol

// name → email pairs with the roles that prisma/seed.ts uses.
const SEED_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
}> = [
  { email: "admin@vance.com", firstName: "Admin", lastName: "User" },
  { email: "pm1@vance.com", firstName: "Pat", lastName: "Martinez" },
  { email: "pm2@vance.com", firstName: "Morgan", lastName: "Lee" },
  { email: "sub1@acme.com", firstName: "Alex", lastName: "Contractor" },
  { email: "sub2@paving.com", firstName: "Priya", lastName: "Singh" },
  { email: "sub3@grading.com", firstName: "Jordan", lastName: "Reyes" }
];

async function findOrCreateClerkUser(
  email: string,
  firstName: string,
  lastName: string
) {
  // Check if user already exists
  const existing = await clerk.users.getUserList({ emailAddress: [email] });
  if (existing.totalCount > 0) {
    return existing.data[0];
  }
  return clerk.users.createUser({
    emailAddress: [email],
    password: SEED_PASSWORD,
    firstName,
    lastName,
    skipPasswordChecks: true
  });
}

async function main() {
  console.log("Seeding Clerk users + linking to Prisma...");

  for (const seed of SEED_USERS) {
    const prismaUser = await prisma.user.findUnique({
      where: { email: seed.email }
    });
    if (!prismaUser) {
      console.warn(`  (skip) No Prisma user for ${seed.email} — run prisma seed first`);
      continue;
    }

    const clerkUser = await findOrCreateClerkUser(
      seed.email,
      seed.firstName,
      seed.lastName
    );

    await clerk.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: prismaUser.role,
        prismaUserId: prismaUser.id
      }
    });

    if (prismaUser.clerkId !== clerkUser.id) {
      await prisma.user.update({
        where: { id: prismaUser.id },
        data: { clerkId: clerkUser.id }
      });
    }

    console.log(
      `  ✓ ${seed.email.padEnd(22)}  role=${prismaUser.role.padEnd(14)} clerkId=${clerkUser.id}`
    );
  }

  console.log("\nClerk seed complete.");
  console.log(`Default password for all seeded users: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
