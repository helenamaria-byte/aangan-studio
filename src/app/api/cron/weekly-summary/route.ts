import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { sendEmail } from "@/lib/clients/resend";
import { getAllCalls } from "@/lib/queries";
import { loadSettings } from "@/lib/settings";
import { verifyCron } from "@/lib/verify";
import { buildWeeklySummary } from "@/lib/weekly";

export const maxDuration = 60;

// Vercel Cron calls this every Monday at 09:00 IST (03:30 UTC). See vercel.json.
export async function GET(req: Request) {
  if (!verifyCron(req.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const db = await getDb();
  const settings = await loadSettings(db);
  if (!settings.ownerEmail) {
    return NextResponse.json({ error: "No owner email is set (OWNER_EMAIL or Settings)" }, { status: 500 });
  }

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const { email, weekKey } = buildWeeklySummary(await getAllCalls(db), settings, new Date(), base);

  // Vercel can deliver a cron more than once. Send each week's summary only once.
  const [last] = await db.select().from(settingsTable).where(eq(settingsTable.key, "lastWeeklySummary"));
  if (last?.value === weekKey) return NextResponse.json({ ok: true, skipped: "already sent", weekKey });

  await sendEmail(settings.ownerEmail, email);
  await db
    .insert(settingsTable)
    .values({ key: "lastWeeklySummary", value: weekKey })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: weekKey } });

  return NextResponse.json({ ok: true, sent: true, weekKey });
}
