import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes — anyone can access
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/after-login(.*)"
]);

// PM/Admin-only routes
const isPmAdminRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)"
]);

// Subcontractor-only routes
const isSubRoute = createRouteMatcher(["/sub-portal(.*)"]);

// API routes — role checks happen in each route handler
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims } = await auth();

  // Require auth for everything else
  if (!userId) {
    if (isApiRoute(req)) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role check for UI routes. sessionClaims can carry publicMetadata.role
  // if the Clerk JWT template is configured to include it — fall back to
  // letting the page-level component re-check against Clerk if absent.
  const role = (sessionClaims?.metadata as any)?.role as string | undefined;

  if (isPmAdminRoute(req)) {
    if (role && !["admin", "pm"].includes(role)) {
      const url = req.nextUrl.clone();
      url.pathname = "/sub-portal";
      return NextResponse.redirect(url);
    }
  }

  if (isSubRoute(req)) {
    if (role && role !== "subcontractor") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
};
