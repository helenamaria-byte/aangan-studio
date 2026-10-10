import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { loadSettings, type AppUser, type Role } from "./settings";

// Email magic links, no password. Stateless: the link and the session cookie are both HMAC-signed with AUTH_SECRET.
// A link is valid for 15 minutes. A session lasts 30 days. Who may sign in is re-checked on every request,
// so removing someone on the Settings page locks them out immediately.

const SESSION_COOKIE = "aangan_session";
const LINK_MINUTES = 15;
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short. Set a long random value (see .env.example).");
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const mac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

function sign(kind: "login" | "session", email: string, ttlMs: number, now = Date.now()): string {
  const body = b64(JSON.stringify({ k: kind, e: email, x: now + ttlMs }));
  return `${body}.${mac(body)}`;
}

function verify(kind: "login" | "session", token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = mac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(unb64(body)) as { k: string; e: string; x: number };
    // A login link can never be used as a session cookie, or the other way round.
    if (p.k !== kind || typeof p.e !== "string" || p.x < now) return null;
    return p.e;
  } catch {
    return null;
  }
}

export const createLoginToken = (email: string, now?: number) => sign("login", email.toLowerCase(), LINK_MINUTES * 60_000, now);
export const readLoginToken = (token: string | undefined, now?: number) => verify("login", token, now);
export const createSessionToken = (email: string, now?: number) => sign("session", email.toLowerCase(), SESSION_DAYS * 86_400_000, now);
export const readSessionToken = (token: string | undefined, now?: number) => verify("session", token, now);

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
export { SESSION_COOKIE };

export async function findUser(email: string): Promise<AppUser | null> {
  const settings = await loadSettings(await getDb());
  return settings.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/** The signed-in user, or null. Reads the cookie, then confirms the person is still on the allowed list. */
export async function getSession(): Promise<AppUser | null> {
  const store = await cookies();
  const email = readSessionToken(store.get(SESSION_COOKIE)?.value);
  return email ? findUser(email) : null;
}

/** Use at the top of every protected page and server action. */
export async function requireUser(role?: Role): Promise<AppUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (role === "owner" && user.role !== "owner") redirect("/");
  return user;
}
