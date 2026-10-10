import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { bookings, calls, designers } from "@/db/schema";
import type { Enquiry } from "./enquiry";
import { buildComplaintEmail, buildFrontDeskEmail, buildHandoffEmail, type BuiltEmail } from "./emails";
import { extractWithLlm } from "./extraction";
import { phoneKey } from "./phone";
import { planActions } from "./plan";
import { errorMessage, withRetry } from "./retry";
import { loadSettings, type AppSettings, type Db } from "./settings";
import { parseVaaniPayload } from "./sources/vaani";
import { isAfterHours } from "./time";
import * as hubspot from "./clients/hubspot";
import { sendEmail } from "./clients/resend";
import { applyCallRecord, fetchCallRecord } from "./clients/vaani-api";

type CallRow = typeof calls.$inferSelect;

const HOUR = 3_600_000;

/** Failures never lose a lead: each step is retried 3 times, then recorded so it shows under "Needs attention". */
class Failures {
  private list: string[] = [];
  async run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await withRetry(fn, 3);
    } catch (err) {
      this.list.push(`${label}: ${errorMessage(err)}`);
      return null;
    }
  }
  add(message: string) {
    this.list.push(message);
  }
  get text() {
    return this.list.length ? this.list.join(" | ") : null;
  }
}

function money(n: number) {
  return String(Math.round(n * 100) / 100);
}

export function rowToEnquiry(row: CallRow): Enquiry {
  const f = (row.extractedFields ?? {}) as Partial<Enquiry>;
  return {
    channel: "phone",
    sourceId: row.vaaniCallId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSec: row.durationSec,
    callerName: f.callerName ?? null,
    callerPhone: row.callerPhone,
    locality: f.locality ?? null,
    propertyType: f.propertyType ?? null,
    sizeSqft: f.sizeSqft ?? null,
    scopeSummary: f.scopeSummary ?? null,
    timelineText: f.timelineText ?? null,
    decisionMaker: f.decisionMaker ?? null,
    budgetMentioned: f.budgetMentioned ?? null,
    outcome: (row.outcome as Enquiry["outcome"]) ?? null,
    declineReason: (row.declineReason as Enquiry["declineReason"]) ?? null,
    doubts: f.doubts ?? null,
    language: f.language ?? null,
    summary: row.summary,
    transcriptUrl: row.transcriptUrl,
    recordingUrl: row.recordingUrl,
    costs: { voiceInr: 0, telephonyInr: 0, llmInr: 0 },
    raw: null,
  };
}

function fieldsForStorage(e: Enquiry, repeatOfCallId: number | null) {
  return {
    callerName: e.callerName,
    locality: e.locality,
    propertyType: e.propertyType,
    sizeSqft: e.sizeSqft,
    scopeSummary: e.scopeSummary,
    timelineText: e.timelineText,
    decisionMaker: e.decisionMaker,
    budgetMentioned: e.budgetMentioned,
    doubts: e.doubts,
    language: e.language,
    repeatOfCallId,
  };
}

// ---------------------------------------------------------------------------------------------
// Vaani end-of-call webhook
// ---------------------------------------------------------------------------------------------

export type VaaniResult =
  | { status: "duplicate" }
  | { status: "created"; callId: number }
  | { status: "unparsed"; callId: number };

export async function ingestVaaniCall(db: Db, raw: unknown): Promise<VaaniResult> {
  const settings = await loadSettings(db);
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const creditToInr = Number(process.env.VAANI_CREDIT_TO_INR ?? 1) || 1;
  const problems: string[] = [];
  let enquiry: Enquiry;
  try {
    enquiry = parseVaaniPayload(raw, { usdToInr: settings.usdToInr, creditToInr });
    if (process.env.EXTRACTION_MODE === "llm" && typeof obj.transcript === "string") {
      enquiry = await extractWithLlm(obj.transcript, enquiry, settings.usdToInr);
    }
  } catch (err) {
    // Rule 5: the raw payload is saved even when parsing fails, so it can be reprocessed.
    const id = typeof obj.call_id === "string" ? obj.call_id : `unparsed-${Date.now()}`;
    const [row] = await db
      .insert(calls)
      .values({
        vaaniCallId: id,
        startedAt: new Date(),
        rawPayload: raw ?? {},
        needsAttention: true,
        errorText: `Could not read this call: ${errorMessage(err)}`,
      })
      .onConflictDoNothing({ target: calls.vaaniCallId })
      .returning({ id: calls.id });
    return row ? { status: "unparsed", callId: row.id } : { status: "duplicate" };
  }

  // The webhook has no caller number or cost. Ask Vaani's call history for them.
  const apiKey = process.env.VAANI_API_KEY;
  if (apiKey) {
    try {
      const rec = await withRetry(() => fetchCallRecord(enquiry.sourceId, apiKey), 3, 1500);
      enquiry = applyCallRecord(enquiry, rec, creditToInr);
    } catch (err) {
      problems.push(`Vaani call history: ${errorMessage(err)}`);
    }
  }
  if (!enquiry.callerPhone) {
    problems.push(
      "No caller phone number for this call, so it cannot be matched to a booking or a CRM contact" +
        (apiKey ? "" : ". Set VAANI_API_KEY so the number can be read from Vaani's call history"),
    );
  }

  const c = enquiry.costs;
  const [inserted] = await db
    .insert(calls)
    .values({
      vaaniCallId: enquiry.sourceId,
      channel: enquiry.channel,
      startedAt: enquiry.startedAt,
      endedAt: enquiry.endedAt,
      durationSec: enquiry.durationSec,
      isAfterHours: isAfterHours(enquiry.startedAt, settings.officeHours),
      callerPhone: enquiry.callerPhone,
      outcome: enquiry.outcome,
      declineReason: enquiry.declineReason,
      extractedFields: fieldsForStorage(enquiry, null),
      summary: enquiry.summary,
      transcriptUrl: enquiry.transcriptUrl,
      recordingUrl: enquiry.recordingUrl,
      rawPayload: raw as object,
      costVoiceInr: money(c.voiceInr),
      costTelephonyInr: money(c.telephonyInr),
      costLlmInr: money(c.llmInr),
      costTotalInr: money(c.voiceInr + c.telephonyInr + c.llmInr),
    })
    // Idempotency: Vaani's call ID is unique, so a repeated webhook changes nothing.
    .onConflictDoNothing({ target: calls.vaaniCallId })
    .returning({ id: calls.id });

  if (!inserted) return { status: "duplicate" };
  await processCall(db, inserted.id, enquiry, settings, problems);
  return { status: "created", callId: inserted.id };
}

async function processCall(db: Db, callId: number, e: Enquiry, settings: AppSettings, earlierProblems: string[] = []) {
  const plan = planActions(e);
  const failures = new Failures();
  for (const p of earlierProblems) failures.add(p);
  const key = phoneKey(e.callerPhone);

  // A dropped call that rings back within 10 minutes no longer needs a callback.
  let repeatOfCallId: number | null = null;
  let knownContactId: string | null = null; // a HubSpot contact we already created for this phone number
  if (key) {
    const recent = await db
      .select()
      .from(calls)
      .where(gte(calls.startedAt, new Date(e.startedAt.getTime() - 14 * 24 * HOUR)))
      .orderBy(desc(calls.startedAt));
    for (const prior of recent) {
      if (prior.id === callId || phoneKey(prior.callerPhone) !== key) continue;
      repeatOfCallId ??= prior.id;
      knownContactId ??= prior.hubspotContactId;
      const gapMs = e.startedAt.getTime() - prior.startedAt.getTime();
      if (prior.outcome === "dropped" && prior.needsAttention && gapMs <= 10 * 60_000) {
        await db.update(calls).set({ needsAttention: false, handledAt: new Date(), errorText: null }).where(eq(calls.id, prior.id));
      }
    }
  }
  if (repeatOfCallId) {
    await db.update(calls).set({ extractedFields: fieldsForStorage(e, repeatOfCallId) }).where(eq(calls.id, callId));
  }

  // 1. Complaints first: Nikhil must hear within a minute. The alert never waits on HubSpot (no contact link in it).
  if (plan.emails.includes("complaint")) {
    const to = settings.ownerEmail;
    if (!to) {
      failures.add("Complaint email: no owner email is set (OWNER_EMAIL or Settings)");
    } else {
      const mail = buildComplaintEmail(e, null);
      await failures.run("Complaint email", () => sendEmail(to, mail));
    }
  }

  // 2. HubSpot
  const [existing] = await db.select().from(calls).where(eq(calls.id, callId));
  let contactId: string | null = existing?.hubspotContactId ?? null;
  let dealId: string | null = existing?.hubspotDealId ?? null;
  const h = plan.hubspot;
  if (h.kind === "deal") {
    contactId ??= await failures.run("HubSpot contact", () =>
      hubspot.upsertContact({ name: e.callerName, phone: e.callerPhone, locality: e.locality }, knownContactId),
    );
    if (contactId && !dealId) {
      const cid = contactId;
      dealId = await failures.run("HubSpot deal", () =>
        hubspot.createDeal(cid, `${e.callerName ?? "Phone enquiry"}, ${e.propertyType ?? "property"} in ${e.locality ?? "Pune"}`, h.stage),
      );
      if (dealId) {
        const did = dealId;
        await failures.run("HubSpot note", () => hubspot.addNote("deals", did, noteText(e)));
      }
    }
  } else if (h.kind === "contact_only") {
    contactId = await failures.run("HubSpot contact", () =>
      hubspot.upsertContact({ name: e.callerName, phone: e.callerPhone, locality: e.locality, declineReason: h.declineReason }, knownContactId),
    );
    // Always record the reason as a note too, so it is visible even if the custom property does not exist yet.
    if (contactId) {
      const cid = contactId;
      await failures.run("HubSpot note", () => hubspot.addNote("contacts", cid, `Declined: ${(h.declineReason ?? "other").replace(/_/g, " ")}. ${noteText(e)}`));
    }
  } else if (h.kind === "note_on_existing") {
    contactId ??= await failures.run("HubSpot lookup", () => hubspot.findContactByPhone(e.callerPhone));
    if (contactId) {
      const cid = contactId;
      await failures.run("HubSpot note", () => hubspot.addNote("contacts", cid, `Complaint call. ${noteText(e)}`));
    }
  }

  await db
    .update(calls)
    .set({ hubspotContactId: contactId, hubspotDealId: dealId })
    .where(eq(calls.id, callId));

  // 3. Emails
  if (plan.emails.includes("front_desk")) {
    const to = settings.frontDeskEmail;
    const mail = buildFrontDeskEmail(e, dealId ? hubspot.dealUrl(dealId) : null);
    await failures.run("Front desk email", async () => {
      if (!to) throw new Error("No front desk email is set (FRONT_DESK_EMAIL or Settings)");
      return sendEmail(to, mail);
    });
  }
  if (plan.emails.includes("handoff")) {
    const res = await finishHandoff(db, callId);
    if (res.error) failures.add(res.error);
  }

  const errorText = failures.text;
  await db
    .update(calls)
    .set({
      needsAttention: Boolean(errorText) || Boolean(plan.attention),
      errorText: errorText ?? plan.attention,
    })
    .where(eq(calls.id, callId));
}

function noteText(e: Enquiry): string {
  return [
    e.summary,
    e.scopeSummary && `Scope: ${e.scopeSummary}`,
    e.timelineText && `Timeline: ${e.timelineText}`,
    e.doubts && `Doubts: ${e.doubts}`,
    e.recordingUrl && `Recording: ${e.recordingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------------------------
// Handoff to the designer. Called from BOTH webhooks, because either may arrive first:
// Cal.com's fires during the call, Vaani's after it ends.
// ---------------------------------------------------------------------------------------------

export async function finishHandoff(
  db: Db,
  callId: number,
): Promise<{ sent: boolean; pending: boolean; error: string | null }> {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!call) return { sent: false, pending: false, error: "Call not found" };
  if (call.handoffSentAt) return { sent: true, pending: false, error: null };
  if (call.outcome !== "qualified_booked") return { sent: false, pending: false, error: null };

  let [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.callId, callId), eq(bookings.status, "booked")));

  if (!booking) {
    const key = phoneKey(call.callerPhone);
    const candidates = await db
      .select()
      .from(bookings)
      .where(and(isNull(bookings.callId), gte(bookings.createdAt, new Date(call.startedAt.getTime() - 6 * HOUR))));
    booking = candidates.find((b) => key && phoneKey(b.attendeePhone) === key)!;
    if (booking) await db.update(bookings).set({ callId }).where(eq(bookings.id, booking.id));
  }
  // The Cal.com webhook has not arrived yet. It will call this function again when it does.
  if (!booking) return { sent: false, pending: true, error: null };

  const [designer] = booking.designerId
    ? await db.select().from(designers).where(eq(designers.id, booking.designerId))
    : [];
  if (!designer) return { sent: false, pending: false, error: "Booking has no designer to send the handoff to" };

  const e = rowToEnquiry(call);
  const f = (call.extractedFields ?? {}) as { repeatOfCallId?: number | null };
  const mail: BuiltEmail = buildHandoffEmail({
    e,
    startsAt: booking.startsAt,
    locationType: booking.locationType === "site" || booking.locationType === "studio" ? booking.locationType : null,
    designerName: designer.name,
    hubspotDealUrl: call.hubspotDealId ? hubspot.dealUrl(call.hubspotDealId) : null,
    isRepeatCaller: Boolean(f.repeatOfCallId),
  });

  try {
    await withRetry(() => sendEmail(designer.email, mail), 3);
  } catch (err) {
    const msg = `Handoff email: ${errorMessage(err)}`;
    await db.update(calls).set({ needsAttention: true, errorText: msg }).where(eq(calls.id, callId));
    return { sent: false, pending: false, error: msg };
  }
  await db.update(calls).set({ handoffSentAt: new Date() }).where(eq(calls.id, callId));
  return { sent: true, pending: false, error: null };
}

/** Retry button on the dashboard (Phase 4) calls this for a call that needs attention. */
export async function retryCall(db: Db, callId: number) {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!call) throw new Error("Call not found");
  const enquiry = parseVaaniPayload(call.rawPayload, { usdToInr: (await loadSettings(db)).usdToInr });
  await db.update(calls).set({ needsAttention: false, errorText: null }).where(eq(calls.id, callId));
  await processCall(db, callId, enquiry, await loadSettings(db));
}
