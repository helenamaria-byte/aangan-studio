import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../src/db";
import { calls, designers } from "../src/db/schema";
import { assignDesigner, pickDesigner } from "../src/lib/assign";
import { nameFromEmail, resolveViewer } from "../src/lib/auth";
import type { AppUser } from "../src/lib/settings";
import { attentionItems, designerStats, OUTCOME_LABELS, scopeCalls, type CallView } from "../src/lib/stats";

process.env.DATABASE_URL = "pglite://memory";
process.env.AUTH_SECRET = "test-secret-with-enough-length-1234";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("giving each new lead to a designer", () => {
  it("picks the designer with the fewest leads, and the earliest one on a tie", () => {
    expect(pickDesigner([{ id: 1, active: true, leads: 2 }, { id: 2, active: true, leads: 1 }, { id: 3, active: true, leads: 1 }])).toBe(2);
    expect(pickDesigner([{ id: 1, active: true, leads: 0 }, { id: 2, active: true, leads: 0 }])).toBe(1);
  });
  it("never picks someone who is switched off, and returns nobody when no one is available", () => {
    expect(pickDesigner([{ id: 1, active: false, leads: 0 }, { id: 2, active: true, leads: 9 }])).toBe(2);
    expect(pickDesigner([{ id: 1, active: false, leads: 0 }])).toBeNull();
    expect(pickDesigner([])).toBeNull();
  });
});

describe("assigning leads in the database", () => {
  afterAll(async () => closeDb());
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(calls);
    await db.delete(designers);
    await db.insert(designers).values([
      { name: "Designer Deekshit", email: "d@x.test" },
      { name: "Designer Jennifer", email: "j@x.test" },
      { name: "Designer Daniel", email: "n@x.test" },
    ]);
  });

  let n = 0;
  const addCall = async (outcome: string) => {
    const db = await getDb();
    const [r] = await db
      .insert(calls)
      .values({ vaaniCallId: `a-${++n}`, startedAt: new Date(), outcome, rawPayload: {} })
      .returning({ id: calls.id });
    return r.id;
  };

  it("shares leads evenly: three leads go to three different designers, the fourth starts again", async () => {
    const db = await getDb();
    const ids = [await addCall("qualified_booked"), await addCall("qualified_no_booking"), await addCall("qualified_booked"), await addCall("qualified_booked")];
    const got: (number | null)[] = [];
    for (const id of ids) got.push(await assignDesigner(db, id));
    expect(new Set(got.slice(0, 3)).size).toBe(3);
    expect(got[3]).toBe(got[0]);
  });

  it("gives a lead to someone only once, and keeps them", async () => {
    const db = await getDb();
    const id = await addCall("qualified_booked");
    const first = await assignDesigner(db, id);
    await addCall("qualified_booked");
    expect(await assignDesigner(db, id)).toBe(first);
  });

  it("does not hand declined calls, complaints, dropped or wrong-number calls to a designer", async () => {
    const db = await getDb();
    for (const o of ["declined", "complaint", "dropped", "spam_or_wrong_number"]) expect(await assignDesigner(db, await addCall(o))).toBeNull();
  });

  it("skips a designer who has been switched off", async () => {
    const db = await getDb();
    const all = await db.select().from(designers);
    for (const d of all.slice(0, 2)) await db.update(designers).set({ active: false }).where(eq(designers.id, d.id));
    const only = all[2].id;
    expect(await assignDesigner(db, await addCall("qualified_booked"))).toBe(only);
    expect(await assignDesigner(db, await addCall("qualified_booked"))).toBe(only);
  });
});

describe("naming the person who is logged in", () => {
  it("turns an email address into a name", () => {
    expect(nameFromEmail("helena_maria@pg27.mesaschool.co")).toBe("Helena Maria");
    expect(nameFromEmail("owner@example.test")).toBe("Owner");
    expect(nameFromEmail("front.desk99@x.co")).toBe("Front Desk");
  });
});

describe("who is logged in and what they may see", () => {
  const owner: AppUser = { email: "o@x.test", role: "owner", name: "Owner" };
  const desk: AppUser = { email: "f@x.test", role: "front_desk", name: "Front desk" };
  const jen: AppUser = { email: "j@x.test", role: "designer", name: "Designer Jennifer", designerId: 2 };

  it("a designer is limited to their own leads", () => {
    const v = resolveViewer(jen, true, null)!;
    expect(v).toMatchObject({ role: "designer", scopeDesignerId: 2, name: "Designer Jennifer", viewingAs: null });
  });
  it("the owner and front desk see everything", () => {
    expect(resolveViewer(owner, true, null)).toMatchObject({ role: "owner", scopeDesignerId: null });
    expect(resolveViewer(desk, true, null)).toMatchObject({ role: "front_desk", scopeDesignerId: null });
  });
  it("the owner can look as a designer, and keeps their real role", () => {
    const v = resolveViewer(owner, true, { id: 3, name: "Designer Daniel" })!;
    expect(v).toMatchObject({ role: "designer", realRole: "owner", scopeDesignerId: 3, viewingAs: { id: 3, name: "Designer Daniel" } });
  });
  it("nobody else can look as a designer", () => {
    expect(resolveViewer(desk, true, { id: 3, name: "Designer Daniel" })).toMatchObject({ role: "front_desk", scopeDesignerId: null, viewingAs: null });
    expect(resolveViewer(jen, true, { id: 3, name: "Designer Daniel" })).toMatchObject({ scopeDesignerId: 2 });
    expect(resolveViewer(null, false, { id: 3, name: "Designer Daniel" })).toMatchObject({ anonymous: true, scopeDesignerId: null, viewingAs: null });
  });
  it("a guest is shown as Guest, and a locked dashboard shows nothing", () => {
    expect(resolveViewer(null, false, null)).toMatchObject({ name: "Guest", anonymous: true });
    expect(resolveViewer(null, true, null)).toBeNull();
  });
});

const call = (over: Partial<CallView>): CallView => ({
  id: 1,
  startedAt: new Date("2026-10-12T05:00:00Z"),
  endedAt: null,
  durationSec: 120,
  isAfterHours: false,
  callerPhone: "+919800000001",
  callerName: "Priya",
  locality: "Baner",
  propertyType: "apartment",
  scopeSummary: null,
  outcome: "qualified_no_booking",
  declineReason: null,
  summary: null,
  costVoice: 0,
  costTelephony: 0,
  costLlm: 0,
  costTotal: 0,
  handoffSentAt: null,
  needsAttention: true,
  handledAt: null,
  errorText: null,
  hubspotDealId: null,
  hubspotContactId: null,
  assignedDesignerId: 1,
  recordingUrl: null,
  transcriptUrl: null,
  ...over,
});
const NOW = new Date("2026-10-12T06:00:00Z");

describe("each person's own list and numbers", () => {
  const all = [
    call({ id: 1, assignedDesignerId: 1 }),
    call({ id: 2, assignedDesignerId: 2, outcome: "qualified_booked", needsAttention: false, handoffSentAt: NOW }),
    call({ id: 3, assignedDesignerId: 2 }),
  ];

  it("scopeCalls keeps only one designer's leads, or everything for null", () => {
    expect(scopeCalls(all, 2).map((c) => c.id)).toEqual([2, 3]);
    expect(scopeCalls(all, null)).toHaveLength(3);
  });
  it("a designer's numbers count only their leads", () => {
    expect(designerStats(scopeCalls(all, 2), "week", NOW)).toMatchObject({ leads: 2, booked: 1, waiting: 1 });
  });
});

describe("Needs attention speaks plainly and never shows a raw error", () => {
  const failing = call({ id: 9, outcome: "qualified_booked", needsAttention: true, errorText: 'Handoff email: Resend 500 {"message":"boom"}' });
  const noFrontDesk = call({ id: 10, outcome: "qualified_booked", needsAttention: true, errorText: "Front desk email: No front desk email is set (FRONT_DESK_EMAIL or Settings)" });
  const missing = call({ id: 11, outcome: "qualified_booked", needsAttention: true, handoffSentAt: NOW, errorText: "No caller phone number for this call, so it cannot be matched. Set VAANI_API_KEY" });
  const unreadable = call({ id: 12, outcome: null, needsAttention: true, errorText: "Could not read this call: Vaani payload has no call id" });

  it("owners see a plain message for a failure, with none of the technical words", () => {
    const msgs = attentionItems([failing, noFrontDesk, unreadable], NOW, "owner").map((i) => i.message);
    expect(msgs.length).toBe(3);
    for (const m of msgs) expect(m).not.toMatch(/Resend|HubSpot|VAANI|FRONT_DESK|payload|\{|500|email is set/i);
  });
  it("a missing detail is not shown to anyone", () => {
    expect(attentionItems([missing], NOW, "owner")).toHaveLength(0);
    expect(attentionItems([missing], NOW, "front_desk")).toHaveLength(0);
  });
  it("a missed call with no number to ring back is not shown", () => {
    expect(attentionItems([call({ outcome: "dropped", callerPhone: null })], NOW, "owner")).toHaveLength(0);
    expect(attentionItems([call({ outcome: "dropped" })], NOW, "owner")).toHaveLength(1);
  });
  it("the front desk sees leads and complaints but not technical failures; a designer sees only new leads", () => {
    const items = [failing, call({ id: 20, outcome: "complaint" }), call({ id: 21 }), call({ id: 22, outcome: "dropped" })];
    expect(attentionItems(items, NOW, "front_desk").map((i) => i.kind).sort()).toEqual(["callback", "complaint", "no_booking"]);
    expect(attentionItems(items, NOW, "designer").map((i) => i.kind)).toEqual(["no_booking"]);
  });
});

describe("the category dropdown and the other controls", () => {
  it("offers exactly the six categories", () => {
    expect(Object.values(OUTCOME_LABELS)).toEqual(["Booked", "Lead", "Declined", "Complaint", "Dropped", "Wrong number"]);
  });
  it("every action that changes a lead checks who is asking, and a designer may only touch their own", () => {
    const a = read("src/app/actions.ts");
    for (const fn of ["markHandled", "setOutcome", "setDesigner", "retryFailed"]) {
      const body = a.match(new RegExp(`export async function ${fn}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`))![1];
      expect(body, fn).toMatch(/requireUser\(/);
    }
    expect(a).toMatch(/row\.assignedDesignerId !== user\.designerId/);
    expect(a.match(/export async function switchView[\s\S]*?\n\}/)![0]).toMatch(/requireUser\("owner"\)/);
  });
  it("designers cannot open reports or settings or download the spreadsheet", () => {
    expect(read("src/app/(app)/reports/page.tsx")).toMatch(/viewer\.role !== "owner"/);
    expect(read("src/app/(app)/settings/page.tsx")).toMatch(/requireUser\("owner"\)/);
    expect(read("src/app/(app)/calls/export/route.ts")).toMatch(/role === "designer"/);
  });
  it("the call page never prints a placeholder for a missing detail, and hides technical details from non-owners", () => {
    const page = read("src/app/(app)/calls/[id]/page.tsx");
    expect(page).not.toMatch(/Not captured|Unknown caller/);
    expect(page).toMatch(/isOwner && c\.errorText/);
    expect(page).toMatch(/children === null/);
  });
});
