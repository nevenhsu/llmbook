import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request);

  const isAuthRoute = AUTH_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  if (isAuthRoute) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
