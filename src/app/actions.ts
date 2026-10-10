"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { calls, designers, settings } from "@/db/schema";
import { sendEmail } from "@/lib/clients/resend";
import { createLoginToken, findUser, requireUser, SESSION_COOKIE } from "@/lib/auth";
import { retryCall } from "@/lib/pipeline";
import { FIXED_COST_KEYS, type AppUser } from "@/lib/settings";

// Every action checks the signed-in user first. Never trust that a page hid the button.

export async function requestLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await findUser(email) : null;

  if (user) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/api/auth/verify?token=${encodeURIComponent(createLoginToken(user.email))}`;
    try {
      await sendEmail(user.email, {
        subject: "Your sign-in link for Aangan Studio",
        text: `Open this link to sign in. It works for 15 minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
        html: `<p style="font-family:system-ui,sans-serif;font-size:16px">Open this link to sign in. It works for 15 minutes.</p><p><a href="${link}">Sign in to Aangan Studio</a></p><p style="color:#7A716B;font-family:system-ui,sans-serif">If you did not ask for this, ignore this email.</p>`,
      });
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("Could not send the sign-in email", err);
        redirect("/login?error=send");
      }
      // Local development without an email key: print the link instead.
      console.log(`\nSign-in link for ${user.email}:\n${link}\n`);
    }
  }
  // Same answer whether or not the address is allowed, so the form cannot be used to find who has access.
  redirect("/login?sent=1");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function markHandled(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await (await getDb())
    .update(calls)
    .set({ needsAttention: false, handledAt: new Date() })
    .where(eq(calls.id, id));
  revalidatePath("/", "layout");
}

export async function retryFailed(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await retryCall(await getDb(), id);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------------------------
// Settings (owner only)
// ---------------------------------------------------------------------------------------------

async function put(key: string, value: unknown) {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value: value as object })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as object } });
}

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();

function done(section: string): never {
  revalidatePath("/", "layout");
  redirect(`/settings?saved=${section}`);
}

export async function saveOfficeHours(formData: FormData) {
  await requireUser("owner");
  const start = Math.min(23, Math.floor(num(formData.get("startHour"), 10)));
  const end = Math.min(24, Math.floor(num(formData.get("endHour"), 19)));
  if (end <= start) redirect("/settings?error=hours");
  const closedDays = formData.getAll("closedDays").map(Number).filter((d) => d >= 0 && d <= 6);
  await put("officeHours", { startHour: start, endHour: end, closedDays });
  done("hours");
}

export async function saveEmails(formData: FormData) {
  await requireUser("owner");
  await put("ownerEmail", text(formData.get("ownerEmail")).toLowerCase());
  await put("frontDeskEmail", text(formData.get("frontDeskEmail")).toLowerCase());
  await put("studioPhone", text(formData.get("studioPhone")));
  done("emails");
}

export async function saveMoney(formData: FormData) {
  await requireUser("owner");
  await put("averageProjectValueInr", num(formData.get("averageProjectValueInr"), 1_100_000));
  await put("usdToInr", num(formData.get("usdToInr"), 85) || 85);
  const fixed: Record<string, number> = {};
  for (const k of FIXED_COST_KEYS) fixed[k] = num(formData.get(`fixed_${k}`));
  await put("fixedMonthlyCostsInr", fixed);
  done("money");
}

export async function saveUsers(formData: FormData) {
  const me = await requireUser("owner");
  const users: AppUser[] = [];
  for (const line of String(formData.get("users") ?? "").split(/\r?\n/)) {
    const [emailRaw, roleRaw] = line.split(",").map((s) => s.trim());
    if (!emailRaw || !/^\S+@\S+\.\S+$/.test(emailRaw)) continue;
    users.push({ email: emailRaw.toLowerCase(), role: roleRaw === "front_desk" ? "front_desk" : "owner" });
  }
  // Never let the signed-in owner lock themselves out.
  if (!users.some((u) => u.email === me.email.toLowerCase() && u.role === "owner")) {
    users.unshift({ email: me.email.toLowerCase(), role: "owner" });
  }
  await put("users", users);
  done("users");
}

export async function addDesigner(formData: FormData) {
  await requireUser("owner");
  const name = text(formData.get("name"));
  const email = text(formData.get("email")).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) redirect("/settings?error=designer");
  await (await getDb()).insert(designers).values({ name, email });
  done("designers");
}

export async function toggleDesigner(formData: FormData) {
  await requireUser("owner");
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!Number.isInteger(id)) return;
  await (await getDb()).update(designers).set({ active: !active }).where(eq(designers.id, id));
  done("designers");
}
