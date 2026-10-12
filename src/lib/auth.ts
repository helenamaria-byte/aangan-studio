import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { and, eq } from "drizzle-orm";
import { designers } from "@/db/schema";
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

/** helena_maria@school.co -> "Helena Maria". Used to greet people who are not designers. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  return local ? local.replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase()) : email;
}

const ROLE_NAME: Record<Role, string> = { owner: "Owner", front_desk: "Front desk", designer: "Designer" };

export async function findUser(email: string): Promise<AppUser | null> {
  const db = await getDb();
  const wanted = email.toLowerCase();
  const settings = await loadSettings(db);
  const listed = settings.users.find((u) => u.email.toLowerCase() === wanted);
  if (listed) return { ...listed, name: nameFromEmail(listed.email) };
  // A designer may sign in with the email on their designer record, while they are switched on.
  const [d] = await db.select().from(designers).where(and(eq(designers.email, wanted), eq(designers.active, true)));
  return d ? { email: wanted, role: "designer", name: d.name, designerId: d.id } : null;
}

/** The signed-in user, or null. Reads the cookie, then confirms the person is still on the allowed list. */
export async function getSession(): Promise<AppUser | null> {
  const store = await cookies();
  const email = readSessionToken(store.get(SESSION_COOKIE)?.value);
  return email ? findUser(email) : null;
}

export const VIEW_AS_COOKIE = "aangan_view_as";

/**
 * Open viewing: unless REQUIRE_LOGIN=true, a visitor who is not signed in may LOOK at Home, Calls and Reports
 * (shown as an owner would see them, read-only). Settings, every button that changes something, and the
 * spreadsheet download still need a real sign-in. Set REQUIRE_LOGIN=true in Vercel to lock everything.
 */
export function viewerFor(session: AppUser | null, requireLogin: boolean): (AppUser & { anonymous?: boolean }) | null {
  if (session) return session;
  if (requireLogin) return null;
  return { email: "visitor", role: "owner", anonymous: true };
}

/** Who is looking, and what they are allowed to see. */
export interface Viewer extends AppUser {
  name: string;
  anonymous?: boolean;
  /** Only leads given to this designer are shown. null means everything. */
  scopeDesignerId: number | null;
  /** The role this person really has. The owner can look as a designer; then `role` is "designer" but this stays "owner". */
  realRole: Role;
  /** Set when the owner is looking as one of the designers. */
  viewingAs: { id: number; name: string } | null;
}

/** Pure, so every rule can be tested. `viewAs` only has any effect for a signed-in owner. */
export function resolveViewer(
  session: AppUser | null,
  requireLogin: boolean,
  viewAs: { id: number; name: string } | null,
): Viewer | null {
  const base = viewerFor(session, requireLogin);
  if (!base) return null;
  const anonymous = Boolean(base.anonymous);
  const name = base.name ?? (anonymous ? "Guest" : ROLE_NAME[base.role]);

  if (base.role === "designer") {
    return { ...base, name, realRole: "designer", scopeDesignerId: base.designerId ?? null, viewingAs: null };
  }
  if (base.role === "owner" && !anonymous && viewAs) {
    return { ...base, name, role: "designer", realRole: "owner", scopeDesignerId: viewAs.id, viewingAs: viewAs };
  }
  return { ...base, name, realRole: base.role, scopeDesignerId: null, viewingAs: null };
}

/** For pages that may be viewed without signing in. Never use this in a server action. */
export async function requireViewer(): Promise<Viewer> {
  const session = await getSession();
  let viewAs: { id: number; name: string } | null = null;
  if (session?.role === "owner") {
    const id = Number((await cookies()).get(VIEW_AS_COOKIE)?.value);
    if (Number.isInteger(id) && id > 0) {
      const [d] = await (await getDb()).select().from(designers).where(and(eq(designers.id, id), eq(designers.active, true)));
      if (d) viewAs = { id: d.id, name: d.name };
    }
  }
  const viewer = resolveViewer(session, process.env.REQUIRE_LOGIN === "true", viewAs);
  if (!viewer) redirect("/login");
  return viewer;
}

/** Use at the top of every protected page and server action. */
export async function requireUser(role?: Role): Promise<AppUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (role === "owner" && user.role !== "owner") redirect("/studio");
  return user;
}
