import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../src/db";
import { calls, designers, settings as settingsTable } from "../src/db/schema";
import { GET } from "../src/app/api/cron/weekly-summary/route";
import { generateSeed } from "../src/lib/seed-data";
import { type AppSettings } from "../src/lib/settings";
import { homeStats, toCallView, type CallRow } from "../src/lib/stats";
import { DEFAULT_OFFICE_HOURS } from "../src/lib/time";
import { buildWeeklySummary } from "../src/lib/weekly";

process.env.DATABASE_URL = "pglite://memory";
process.env.RESEND_API_KEY = "r";
process.env.EMAIL_FROM = "Aangan <a@example.test>";
process.env.OWNER_EMAIL = "nikhil@example.test";
process.env.CRON_SECRET = "cron-secret";
process.env.APP_URL = "https://aangan.example.test";

// Monday 12 Oct 2026, 09:00 IST: the moment the cron fires.
const MONDAY = new Date("2026-10-12T03:30:00Z");

const settings: AppSettings = {
  officeHours: DEFAULT_OFFICE_HOURS,
  usdToInr: 85,
  frontDeskEmail: null,
  ownerEmail: "nikhil@example.test",
  averageProjectValueInr: 1_100_000,
  fixedMonthlyCostsInr: { vercel: 1700, neon: 1600, hubspot: 3200, calcom: 1000, resend: 1700 },
  users: [],
  studioPhone: null,
};
const views = generateSeed(MONDAY).calls.map((c, i) => toCallView({ id: i + 1, createdAt: MONDAY, hubspotContactId: null, hubspotDealId: null, ...c } as unknown as CallRow));

describe("weekly summary content", () => {
  const { email, weekKey } = buildWeeklySummary(views, settings, MONDAY, "https://aangan.example.test");

  it("covers the Monday-to-Sunday week that just ended", () => {
    expect(weekKey).toBe("2026-10-05");
  });

  it("has the same four numbers as the dashboard home, for that week", () => {
    const s = homeStats(views, settings, "week", new Date("2026-10-11T18:29:59Z"));
    expect(email.text).toContain(`Calls answered: ${s.answered}`);
    expect(email.text).toContain(`Consultations booked: ${s.booked}`);
    expect(email.text).toContain("Est. pipeline value:");
    expect(email.text).toMatch(/Cost last week: ₹[\d,]+ \(₹[\d,]+ per booked consultation\)/);
    expect(email.subject).toContain(`${s.booked} consultations booked`);
  });

  it("lists what needs attention, with a link to the dashboard", () => {
    expect(email.text).toMatch(/Needs attention \(\d+\):/);
    expect(email.text).toContain("Complaint");
    expect(email.text).toContain("https://aangan.example.test");
    expect(email.html).toContain('href="https://aangan.example.test"');
  });

  it("says all clear when nothing needs attention", () => {
    const clear = views.map((c) => ({ ...c, needsAttention: false, handoffSentAt: c.handoffSentAt ?? MONDAY }));
    expect(buildWeeklySummary(clear, settings, MONDAY, "x").email.text).toContain("All clear");
  });

  it("copes with a week that had no calls", () => {
    const out = buildWeeklySummary([], settings, MONDAY, "x").email;
    expect(out.text).toContain("no calls last week");
    expect(out.text).not.toMatch(/NaN|undefined/);
  });
});

describe("schedule", () => {
  it("vercel.json fires on Mondays at 03:30 UTC, which is 09:00 IST", () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, "..", "vercel.json"), "utf8"));
    expect(cfg.crons).toEqual([{ path: "/api/cron/weekly-summary", schedule: "30 3 * * 1" }]);
    const istHour = new Date(Date.UTC(2026, 9, 12, 3, 30) + 330 * 60_000);
    expect([istHour.getUTCHours(), istHour.getUTCMinutes(), istHour.getUTCDay()]).toEqual([9, 0, 1]);
  });
});

describe("cron route", () => {
  const sent: { to: string[]; subject: string }[] = [];

  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const b = JSON.parse(String(init?.body));
        sent.push({ to: b.to, subject: b.subject });
        return new Response(JSON.stringify({ id: "e1" }));
      }),
    );
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await closeDb();
  });
  beforeEach(async () => {
    sent.length = 0;
    const db = await getDb();
    await db.delete(settingsTable);
    await db.delete(calls);
    await db.delete(designers);
  });

  const call = (auth?: string) => GET(new Request("https://x.test/api/cron/weekly-summary", { headers: auth ? { authorization: auth } : {} }));

  it("refuses requests without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("emails the owner once, and ignores a repeated delivery for the same week", async () => {
    const first = await (await call("Bearer cron-secret")).json();
    expect(first.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["nikhil@example.test"]);
    expect(sent[0].subject).toMatch(/^Aangan weekly summary/);

    const second = await (await call("Bearer cron-secret")).json();
    expect(second.skipped).toBe("already sent");
    expect(sent).toHaveLength(1);
  });

  it("reports a problem if no owner email is set", async () => {
    const db = await getDb();
    await db.insert(settingsTable).values({ key: "ownerEmail", value: "" });
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(sent).toHaveLength(0);
  });
});
