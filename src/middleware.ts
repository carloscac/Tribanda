import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  const fromPath = req.nextUrl.pathname.match(/^\/app\/torneos\/([^/]+)/)?.[1];
  const fromQuery = req.nextUrl.searchParams.get("torneo");
  const id = fromPath && fromPath !== "nuevo" ? fromPath : fromQuery;
  if (id) requestHeaders.set("x-tournament", id);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (id) {
    response.cookies.set("active-tournament", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
});

export const config = {
  matcher: ["/app/:path*", "/participante/:path*"],
};
