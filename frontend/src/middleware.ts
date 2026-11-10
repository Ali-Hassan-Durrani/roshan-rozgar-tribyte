import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const AREAS: [string, string][] = [
  ["/c", "CUSTOMER"],
  ["/w", "WORKER"],
  ["/admin", "ADMIN"],
];

/** UX-only route guard by role. The backend re-checks every request. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const area = AREAS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  if (!area) return NextResponse.next();

  const token = req.cookies.get("rr_at")?.value;
  const hasRefresh = !!req.cookies.get("rr_rt");
  let role: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
      role = payload.role as string;
    } catch {
      // expired → let the page refresh the session client-side
    }
  }
  if (!role && hasRefresh) return NextResponse.next();
  if (!role) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    if (area[1] === "WORKER") url.searchParams.set("role", "WORKER");
    return NextResponse.redirect(url);
  }
  if (role !== area[1]) {
    const home = role === "WORKER" ? "/w" : role === "ADMIN" ? "/admin" : "/";
    return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/c/:path*", "/w/:path*", "/admin/:path*"] };
