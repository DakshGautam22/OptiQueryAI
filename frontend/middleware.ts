import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;

  // Define public/auth paths
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!token && !isAuthPage) {
    // Redirect to login if attempting to access protected route without token
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    // Redirect authenticated users trying to access login/register back to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Match all routes except API, static resources, image optimizations, and favicon
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
