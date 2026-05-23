import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { UserRole } from "@/types";

// Define route permissions
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/admin": ["ADMIN"],
  "/admin/users": ["ADMIN"],
  "/admin/practitioners": ["ADMIN"],
  "/admin/settings": ["ADMIN"],
  "/admin/audit": ["ADMIN"],
  "/clinical": ["PHYSICIAN", "NURSE", "MEDICAL_ASSISTANT"],
  "/clinical/vitals": ["PHYSICIAN", "NURSE", "MEDICAL_ASSISTANT"],
  "/clinical/medications": ["PHYSICIAN", "NURSE"],
  "/clinical/allergies": ["PHYSICIAN", "NURSE", "MEDICAL_ASSISTANT"],
  "/reports": ["ADMIN", "PHYSICIAN"],
  "/patients/new": ["ADMIN", "PHYSICIAN", "FRONT_DESK"],
};

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/public",
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow public routes
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Check if user is authenticated
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = token.role as UserRole;

    // Check route-specific permissions
    for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(route)) {
        if (!allowedRoles.includes(userRole)) {
          // Redirect to unauthorized page or dashboard
          return NextResponse.redirect(new URL("/", req.url));
        }
      }
    }

    // Add security headers
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self';"
    );

    return response;
  },
  {
    callbacks: {
      authorized({ req, token }) {
        // Allow public routes without token
        const { pathname } = req.nextUrl;
        if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
