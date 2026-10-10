import { NextResponse } from "next/server";
import { createSessionToken, findUser, readLoginToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = readLoginToken(url.searchParams.get("token") ?? undefined);
  const user = email ? await findUser(email) : null;
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.email), sessionCookieOptions);
  return res;
}
