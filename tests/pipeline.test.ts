// Integration tests: the real pipeline against a real (in-memory) Postgres, with HubSpot and Resend faked.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../src/db";
import { bookings, calls, designers } from "../src/db/schema";
import { ingestCalcom, parseCalcom } from "../src/lib/calcom";
import { finishHandoff, ingestVaaniCall } from "../src/lib/pipeline";

process.env.DATABASE_URL = "pglite://memory";
process.env.HUBSPOT_ACCESS_TOKEN = "t";
process.env.HUBSPOT_STAGE_BOOKED = "stage-booked";
process.env.HUBSPOT_STAGE_NEW = "stage-new";
process.env.HUBSPOT_STAGE_CANCELLED = "stage-cancelled";
process.env.HUBSPOT_PORTAL_ID = "999";
process.env.RESEND_API_KEY = "r";
process.env.EMAIL_FROM = "Aangan <a@example.test>";
process.env.OWNER_EMAIL = "nikhil@example.test";
process.env.FRONT_DESK_EMAIL = "desk@example.test";

interface Sent {
  kind: "email" | "hubspot";
  method: string;
  url: string;
  body: Record<string, unknown>;
}
let sent: Sent[] = [];
let existingContact: string | null = null; // HubSpot already has this phone number
let hubspotDown = false;
let resendDown = false;
let rejectAddress: string | null = null; // Resend refuses mail to this one address (like a sandbox that only allows the owner)
let missingDeclineProperty = false; // the custom HubSpot property has not been created yet
let vaaniHistory: Record<string, unknown>[] = []; // rows returned by the fake Vaani call-history API

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const method = init?.method ?? "GET";
  const json = (o: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status }));

  if (url.includes("api.vaanivoice.ai")) {
    return json({ data: vaaniHistory, pagination: { page: 1, page_size: 200, has_next: false } });
  }
  if (url.includes("api.resend.com")) {
    sent.push({ kind: "email", method, url, body });
    if (rejectAddress && (body.to as string[]).includes(rejectAddress)) return json({ message: "not allowed" }, 403);
    return resendDown ? json({ message: "down" }, 500) : json({ id: "e1" });
  }
  sent.push({ kind: "hubspot", method, url, body });
  if (hubspotDown) return json({ message: "down" }, 500);
  if (missingDeclineProperty && JSON.stringify(body).includes("aangan_decline_reason")) {
    return json({ status: "error", message: "Property aangan_decline_reason does not exist", category: "VALIDATION_ERROR" }, 400);
  }
  if (url.endsWith("/contacts/search")) return json({ results: existingContact ? [{ id: existingContact }] : [] });
  if (url.endsWith("/objects/contacts") && method === "POST") return json({ id: "contact-new" });
  if (url.endsWith("/objects/deals") && method === "POST") return json({ id: "deal-1" });
  return json({});
}

const fixture = (id: string, over: Record<string, unknown> = {}) => {
  const p = JSON.parse(readFileSync(join(__dirname, "fixtures", `${id}.json`), "utf8"));
  // Fresh timestamps: the pipeline matches Cal.com bookings to calls that just happened.
  const start = new Date(Date.now() - 5 * 60_000);
  const { _expect, ...payload } = p;
  void _expect;
  return { ...payload, started_at: start.toISOString(), ended_at: new Date(start.getTime() + 4 * 60_000).toISOString(), ...over };
};

const emails = () => sent.filter((s) => s.kind === "email");
const recipients = () => emails().map((e) => (e.body.to as string[])[0]);

async function addDesigner() {
  const db = await getDb();
  await db.insert(designers).values({ name: "Aryan Kulkarni", email: "aryan@example.test" });
}
const calcomBooking = (phone: string, uid = "bk-1") =>
  parseCalcom({
    triggerEvent: "BOOKING_CREATED",
    payload: {
      uid,
      startTime: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      organizer: { email: "aryan@example.test", name: "Aryan Kulkarni" },
      attendees: [{ name: "Priya", phoneNumber: phone }],
      location: "Client site",
    },
  })!;

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await closeDb();
});
beforeEach(async () => {
  sent = [];
  existingContact = null;
  hubspotDown = false;
  resendDown = false;
  rejectAddress = null;
  missingDeclineProperty = false;
  vaaniHistory = [];
  delete process.env.VAANI_API_KEY;
  const db = await getDb();
  await db.delete(bookings);
  await db.delete(calls);
  await db.delete(designers);
});

describe("Vaani webhook pipeline", () => {
  it("is idempotent: the same call delivered twice changes nothing and sends nothing twice", async () => {
    const db = await getDb();
    const p = fixture("T03");
    expect((await ingestVaaniCall(db, p)).status).toBe("created");
    const before = sent.length;
    expect((await ingestVaaniCall(db, p)).status).toBe("duplicate");
    expect(sent.length).toBe(before);
    expect(await db.select().from(calls)).toHaveLength(1);
  });

  it("stores the raw payload, the outcome and the cost, and marks after-hours calls", async () => {
    const db = await getDb();
    const night = new Date(Date.now());
    night.setUTCHours(18, 0, 0, 0); // 23:30 IST, always after hours
    await ingestVaaniCall(db, fixture("T08", { started_at: night.toISOString(), ended_at: new Date(night.getTime() + 140_000).toISOString() }));
    const [row] = await db.select().from(calls);
    expect(row.rawPayload).toMatchObject({ call_id: "fx-t08" });
    expect(row.outcome).toBe("qualified_no_booking");
    expect(row.isAfterHours).toBe(true);
    expect(Number(row.costTotalInr)).toBeGreaterThan(0);
  });

  it("a payload that cannot be read is still saved and flagged, never lost", async () => {
    const db = await getDb();
    const res = await ingestVaaniCall(db, { call_id: "broken-1", nothing_useful: true });
    expect(res.status).toBe("unparsed");
    const [row] = await db.select().from(calls);
    expect(row.needsAttention).toBe(true);
    expect(row.rawPayload).toMatchObject({ call_id: "broken-1" });
  });

  it("complaint: Nikhil is emailed before anything else, with the Urgent subject", async () => {
    const db = await getDb();
    await ingestVaaniCall(db, fixture("T09"));
    expect(sent[0].kind).toBe("email");
    expect((sent[0].body.to as string[])[0]).toBe("nikhil@example.test");
    expect(sent[0].body.subject).toMatch(/^Urgent:/);
    const [row] = await db.select().from(calls);
    expect(row.needsAttention).toBe(true);
    expect(row.hubspotDealId).toBeNull(); // a complaint is not a lead
  });

  it("declined: HubSpot contact tagged with the reason, and no email", async () => {
    const db = await getDb();
    await ingestVaaniCall(db, fixture("T03"));
    expect(emails()).toHaveLength(0);
    const create = sent.find((s) => s.url.endsWith("/objects/contacts") && s.method === "POST");
    expect((create!.body.properties as Record<string, string>).aangan_decline_reason).toBe("out_of_area");
    expect(sent.some((s) => s.url.endsWith("/objects/deals"))).toBe(false);
  });

  it("does not create a second HubSpot contact for a phone number it already has", async () => {
    const db = await getDb();
    existingContact = "contact-existing";
    await ingestVaaniCall(db, fixture("T03"));
    expect(sent.some((s) => s.url.endsWith("/objects/contacts") && s.method === "POST")).toBe(false);
    expect(sent.some((s) => s.url.endsWith("/objects/contacts/contact-existing") && s.method === "PATCH")).toBe(true);
  });

  it("a repeat caller reuses the contact we already made, even when HubSpot search is lagging (empty)", async () => {
    const db = await getDb();
    // existingContact stays null, so every HubSpot search returns nothing, like a search index that has not caught up.
    await ingestVaaniCall(db, fixture("T03", { call_id: "first-call" }));
    await ingestVaaniCall(db, fixture("T03", { call_id: "second-call", started_at: new Date(Date.now() - 60_000).toISOString() }));
    const creates = sent.filter((s) => s.url.endsWith("/objects/contacts") && s.method === "POST");
    expect(creates).toHaveLength(1);
    const rows = await db.select().from(calls);
    expect(new Set(rows.map((r) => r.hubspotContactId)).size).toBe(1);
  });

  it("qualified with no booking: deal at 'new', and the front desk is emailed", async () => {
    const db = await getDb();
    await ingestVaaniCall(db, fixture("X03-no-booking"));
    expect(recipients()).toEqual(["desk@example.test"]);
    const deal = sent.find((s) => s.url.endsWith("/objects/deals"))!;
    expect((deal.body.properties as Record<string, string>).dealstage).toBe("stage-new");
    const [row] = await db.select().from(calls);
    expect(row.needsAttention).toBe(true);
  });

  it("declined: the reason is also written as a note, and a missing custom property never loses the lead", async () => {
    const db = await getDb();
    missingDeclineProperty = true;
    await ingestVaaniCall(db, fixture("T03"));
    const [row] = await db.select().from(calls);
    expect(row.hubspotContactId).toBe("contact-new"); // saved without the property
    expect(row.needsAttention).toBe(false);
    const note = sent.find((s) => s.url.endsWith("/objects/notes"))!;
    expect((note.body.properties as Record<string, string>).hs_note_body).toMatch(/Declined: out of area/);
  });

  it("uses HubSpot's default pipeline stages when none are configured", async () => {
    const db = await getDb();
    const saved = { b: process.env.HUBSPOT_STAGE_BOOKED, n: process.env.HUBSPOT_STAGE_NEW };
    delete process.env.HUBSPOT_STAGE_BOOKED;
    delete process.env.HUBSPOT_STAGE_NEW;
    try {
      await ingestVaaniCall(db, fixture("X03-no-booking"));
      const deal = sent.find((s) => s.url.endsWith("/objects/deals"))!;
      expect((deal.body.properties as Record<string, string>).dealstage).toBe("appointmentscheduled");
    } finally {
      process.env.HUBSPOT_STAGE_BOOKED = saved.b;
      process.env.HUBSPOT_STAGE_NEW = saved.n;
    }
  });

  it("HubSpot down: tried 3 times, then flagged under needs attention with the error. The call is kept", async () => {
    const db = await getDb();
    hubspotDown = true;
    await ingestVaaniCall(db, fixture("T03"));
    expect(sent.filter((s) => s.kind === "hubspot")).toHaveLength(3);
    const [row] = await db.select().from(calls);
    expect(row.needsAttention).toBe(true);
    expect(row.errorText).toMatch(/HubSpot contact/);
    expect(row.outcome).toBe("declined");
  }, 15_000);

  it("a dropped call under a minute needs a callback, and a call back within 10 minutes clears it", async () => {
    const db = await getDb();
    const t0 = Date.now() - 8 * 60_000;
    await ingestVaaniCall(db, fixture("X01-dropped", { call_id: "d1", started_at: new Date(t0).toISOString(), from_number: "+919811111111", analysis: { outcome: "dropped", caller_phone: "+919811111111" } }));
    expect((await db.select().from(calls).where(eq(calls.vaaniCallId, "d1")))[0].needsAttention).toBe(true);

    await ingestVaaniCall(db, fixture("T17", { call_id: "d2", started_at: new Date(t0 + 2 * 60_000).toISOString(), ended_at: new Date(t0 + 6 * 60_000).toISOString(), analysis: { outcome: "declined", decline_reason: "other", caller_phone: "+91 98111 11111" } }));
    const first = (await db.select().from(calls).where(eq(calls.vaaniCallId, "d1")))[0];
    expect(first.needsAttention).toBe(false);
    expect(first.handledAt).not.toBeNull();
  });
});

describe("Vaani's real call_postprocessing event", () => {
  const doc = (over: Record<string, unknown> = {}) => ({
    event: "call_postprocessing",
    call_id: "inbound-doc-1",
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    data: {
      room_name: "room_1", call_id: "inbound-doc-1", call_duration: 180000, end_reason: "USER_DISCONNECT",
      summary: "Declined: outside Pune.", recording_url: "https://api.vaanivoice.ai/api/stream/inbound-doc-1", transcript: "AGENT: hi",
      entities: { caller_name: "Suresh", locality: "Nashik", property_type: "house", outcome: "declined", decline_reason: "out_of_area" },
    },
    ...over,
  });

  it("takes the caller's number and the cost from Vaani's call history, because the webhook has neither", async () => {
    const db = await getDb();
    process.env.VAANI_API_KEY = "k";
    process.env.VAANI_CREDIT_TO_INR = "4";
    vaaniHistory = [{ call_id: "inbound-doc-1", direction: "Incoming", from_number: "+919811112222", to_number: "+912000000000", call_cost: 2.5 }];
    await ingestVaaniCall(db, doc());
    delete process.env.VAANI_CREDIT_TO_INR;
    const [row] = await db.select().from(calls);
    expect(row.callerPhone).toBe("+919811112222"); // from_number, since the call was inbound
    expect(Number(row.costTotalInr)).toBeCloseTo(10, 2); // 2.5 credits at 4 rupees
    expect(row.durationSec).toBe(180);
    expect(row.needsAttention).toBe(false);
    expect(sent.find((s) => s.url.endsWith("/objects/contacts") && s.method === "POST")).toBeTruthy();
  });

  it("flags a LEAD that has no phone number anywhere, and says how to fix it, but still saves it", async () => {
    const db = await getDb();
    const payload = doc();
    const ent = payload.data.entities as Record<string, unknown>;
    delete ent.caller_phone;
    ent.outcome = "qualified_no_booking";
    delete ent.decline_reason;
    await ingestVaaniCall(db, payload);
    const [row] = await db.select().from(calls);
    expect(row.outcome).toBe("qualified_no_booking");
    expect(row.needsAttention).toBe(true);
    expect(row.errorText).toMatch(/No caller phone number.*VAANI_API_KEY/);
  });

  it("does NOT flag a declined or dropped call for lacking a number, and creates no empty HubSpot contact", async () => {
    const db = await getDb();
    // a decline with no number
    const declinedPayload = doc({ call_id: "no-phone-declined" });
    declinedPayload.data.call_id = "no-phone-declined"; // Vaani repeats the id inside data
    await ingestVaaniCall(db, declinedPayload);
    // a dropped call where nobody spoke
    await ingestVaaniCall(db, {
      event: "call_postprocessing",
      call_id: "silent-1",
      timestamp: new Date().toISOString(),
      data: { call_duration: 25.4, entities: { outcome: "dropped" }, summary: "Nobody spoke." },
    });
    const rows = await db.select().from(calls);
    const declined = rows.find((r) => r.vaaniCallId === "no-phone-declined")!;
    expect(declined.errorText).toBeNull();
    expect(declined.hubspotContactId).toBeNull();
    expect(sent.some((s) => s.url.endsWith("/objects/contacts") && s.method === "POST")).toBe(false);
    const dropped = rows.find((r) => r.vaaniCallId === "silent-1")!;
    expect(dropped.errorText).toBe("Needs callback"); // the normal short-call rule, not a missing-number complaint
    expect(dropped.durationSec).toBe(25);
  });

  it("with no front desk address set, a lead's note goes to the owner instead of failing", async () => {
    const db = await getDb();
    const saved = process.env.FRONT_DESK_EMAIL;
    delete process.env.FRONT_DESK_EMAIL;
    try {
      const payload = doc();
      const ent = payload.data.entities as Record<string, unknown>;
      ent.outcome = "qualified_no_booking";
      delete ent.decline_reason;
      ent.caller_phone = "+919833335555";
      await ingestVaaniCall(db, payload);
      expect(recipients()).toEqual(["nikhil@example.test"]);
      expect((await db.select().from(calls))[0].errorText).toBe("Qualified lead with no booking yet");
    } finally {
      process.env.FRONT_DESK_EMAIL = saved;
    }
  });

  it("if call history is down, the call is still saved with its spoken phone number and flagged", async () => {
    const db = await getDb();
    process.env.VAANI_API_KEY = "k"; // history returns no matching row, as when post-processing lags
    const payload = doc();
    (payload.data.entities as Record<string, unknown>).caller_phone = "+919833334444";
    await ingestVaaniCall(db, payload);
    const [row] = await db.select().from(calls);
    expect(row.callerPhone).toBe("+919833334444");
    expect(row.needsAttention).toBe(true);
    expect(row.errorText).toMatch(/Vaani call history/);
  }, 15_000);
});

describe("leads go to their own designer", () => {
  const team = async () => {
    const db = await getDb();
    await db.insert(designers).values([
      { name: "Designer Deekshit", email: "deekshit@example.test" },
      { name: "Designer Jennifer", email: "jennifer@example.test" },
    ]);
    return db;
  };

  it("a booked lead is given to a designer, and the handoff goes to THAT designer, not to whoever Cal.com picked", async () => {
    const db = await team();
    await ingestCalcom(db, calcomBooking("+919800000001")); // Cal.com's organizer becomes a third designer record
    await ingestVaaniCall(db, fixture("T01"));
    const [row] = await db.select().from(calls);
    const [deekshit] = await db.select().from(designers).where(eq(designers.email, "deekshit@example.test"));
    expect(row.assignedDesignerId).toBe(deekshit.id);
    expect(recipients()).toEqual(["deekshit@example.test"]);
    expect(String(emails()[0].body.text)).toMatch(/Hi Designer Deekshit/);
  });

  it("the next lead goes to the next designer", async () => {
    const db = await team();
    await ingestVaaniCall(db, fixture("X03-no-booking", { call_id: "lead-a" }));
    const p = fixture("X03-no-booking", { call_id: "lead-b" });
    p.analysis = { ...p.analysis, caller_phone: "+919811110000" };
    await ingestVaaniCall(db, p);
    const rows = await db.select().from(calls);
    expect(new Set(rows.map((r) => r.assignedDesignerId)).size).toBe(2);
  });

  it("if the designer's address cannot receive mail, the note goes to the owner instead, and nothing is flagged", async () => {
    const db = await team();
    rejectAddress = "deekshit@example.test";
    await ingestCalcom(db, calcomBooking("+919800000001"));
    await ingestVaaniCall(db, fixture("T01"));
    const [row] = await db.select().from(calls);
    expect(row.handoffSentAt).not.toBeNull();
    expect(row.errorText).toBeNull();
    expect(row.needsAttention).toBe(false);
    expect(recipients()).toContain("nikhil@example.test");
    const copy = emails().find((e) => (e.body.to as string[])[0] === "nikhil@example.test")!;
    expect(copy.body.subject).toMatch(/^For Designer Deekshit: New consultation/);
  }, 15_000);

  it("complaints and declined calls are never given to a designer", async () => {
    const db = await team();
    await ingestVaaniCall(db, fixture("T09"));
    await ingestVaaniCall(db, fixture("T03"));
    for (const r of await db.select().from(calls)) expect(r.assignedDesignerId).toBeNull();
  });
});

describe("designer handoff: either webhook can arrive first", () => {
  it("Cal.com first, then Vaani: one email to the designer Cal.com picked", async () => {
    const db = await getDb();
    const phone = "+919800000001";
    await ingestCalcom(db, calcomBooking(phone)); // booked during the call
    expect(emails()).toHaveLength(0);

    await ingestVaaniCall(db, fixture("T01"));
    expect(recipients()).toEqual(["aryan@example.test"]);
    expect(emails()[0].body.subject).toMatch(/^New consultation: Priya, apartment in Kothrud/);
    const [row] = await db.select().from(calls);
    expect(row.handoffSentAt).not.toBeNull();
    expect(row.needsAttention).toBe(false);
    const [b] = await db.select().from(bookings);
    expect(b.callId).toBe(row.id);
    expect(String(emails()[0].body.text)).toMatch(/Already asked on the call/);
  });

  it("Vaani first, then Cal.com: the email goes out when the booking arrives, once", async () => {
    const db = await getDb();
    await addDesigner();
    await ingestVaaniCall(db, fixture("T01"));
    expect(emails()).toHaveLength(0);
    const [pending] = await db.select().from(calls);
    expect(pending.handoffSentAt).toBeNull();

    await ingestCalcom(db, calcomBooking("+91 98000 00001"));
    expect(recipients()).toEqual(["aryan@example.test"]);

    // A second delivery of the same Cal.com webhook must not email the designer again.
    await ingestCalcom(db, calcomBooking("+91 98000 00001"));
    expect(emails()).toHaveLength(1);
  });

  it("Resend down: flagged for retry, and the retry sends it once Resend is back", async () => {
    const db = await getDb();
    await ingestCalcom(db, calcomBooking("+919800000001"));
    resendDown = true;
    await ingestVaaniCall(db, fixture("T01"));
    const [row] = await db.select().from(calls);
    expect(row.handoffSentAt).toBeNull();
    expect(row.needsAttention).toBe(true);
    expect(row.errorText).toMatch(/Handoff email/);

    resendDown = false;
    const res = await finishHandoff(db, row.id);
    expect(res.sent).toBe(true);
    expect((await db.select().from(calls))[0].handoffSentAt).not.toBeNull();
  }, 15_000);

  it("a cancelled booking moves the HubSpot deal and flags the lead for follow-up", async () => {
    const db = await getDb();
    await ingestCalcom(db, calcomBooking("+919800000001"));
    await ingestVaaniCall(db, fixture("T01"));
    sent = [];
    await ingestCalcom(db, { ...calcomBooking("+919800000001"), event: "cancelled" });
    const patch = sent.find((s) => s.method === "PATCH" && s.url.includes("/deals/"))!;
    expect((patch.body.properties as Record<string, string>).dealstage).toBe("stage-cancelled");
    const [row] = await db.select().from(calls);
    expect(row.needsAttention).toBe(true);
    const [b] = await db.select().from(bookings);
    expect(b.status).toBe("cancelled");
  });
});
