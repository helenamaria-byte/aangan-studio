import { and, desc, eq, gte } from "drizzle-orm";
import { bookings, calls, designers } from "@/db/schema";
import { phoneKey } from "./phone";
import { errorMessage, withRetry } from "./retry";
import type { Db } from "./settings";
import { finishHandoff } from "./pipeline";
import * as hubspot from "./clients/hubspot";

// Cal.com webhook payload (BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED).
// TODO: confirm the phone field and location wording against a real test booking. Read defensively until then.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export interface ParsedBooking {
  event: "created" | "rescheduled" | "cancelled";
  uid: string;
  startsAt: Date;
  organizerEmail: string | null;
  organizerName: string | null;
  attendeeName: string | null;
  attendeePhone: string | null;
  locationType: "site" | "studio" | null;
}

export function parseCalcom(body: unknown): ParsedBooking | null {
  const b = obj(body);
  const p = obj(b.payload);
  const trigger = str(b.triggerEvent);
  const event =
    trigger === "BOOKING_CREATED" ? "created"
    : trigger === "BOOKING_RESCHEDULED" ? "rescheduled"
    : trigger === "BOOKING_CANCELLED" ? "cancelled"
    : null;
  if (!event) return null; // other Cal.com events are acknowledged and ignored

  const uid = str(p.uid) ?? str(p.bookingId) ?? (typeof p.bookingId === "number" ? String(p.bookingId) : null);
  const start = str(p.startTime);
  if (!uid || !start) throw new Error("Cal.com payload has no booking uid or startTime");
  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Cal.com payload has an invalid startTime");

  const organizer = obj(p.organizer);
  const attendee = obj(Array.isArray(p.attendees) ? p.attendees[0] : null);
  const responses = obj(p.responses);
  const phone =
    str(attendee.phoneNumber) ??
    str(obj(responses.attendeePhoneNumber).value) ??
    str(obj(responses.phone).value) ??
    str(obj(responses.attendeePhoneNumber).value);

  const location = (str(p.location) ?? "").toLowerCase();
  const locationType = /studio|office/.test(location) ? "studio" : location ? "site" : null;

  return {
    event,
    uid,
    startsAt,
    organizerEmail: str(organizer.email),
    organizerName: str(organizer.name),
    attendeeName: str(attendee.name),
    attendeePhone: phone,
    locationType,
  };
}

export async function ingestCalcom(db: Db, parsed: ParsedBooking): Promise<{ bookingId: number; callId: number | null }> {
  // Designer: whoever Cal.com's round-robin assigned. Created on first sight so a new designer never blocks a handoff.
  let designerId: number | null = null;
  if (parsed.organizerEmail) {
    const [found] = await db.select().from(designers).where(eq(designers.email, parsed.organizerEmail));
    if (found) designerId = found.id;
    else {
      const [created] = await db
        .insert(designers)
        .values({ name: parsed.organizerName ?? parsed.organizerEmail, email: parsed.organizerEmail })
        .returning({ id: designers.id });
      designerId = created.id;
    }
  }

  const status = parsed.event === "cancelled" ? "cancelled" : parsed.event === "rescheduled" ? "rescheduled" : "booked";
  const [booking] = await db
    .insert(bookings)
    .values({
      calcomBookingId: parsed.uid,
      designerId,
      startsAt: parsed.startsAt,
      attendeePhone: parsed.attendeePhone,
      attendeeName: parsed.attendeeName,
      locationType: parsed.locationType,
      status,
    })
    .onConflictDoUpdate({
      target: bookings.calcomBookingId,
      set: { startsAt: parsed.startsAt, status, ...(designerId ? { designerId } : {}) },
    })
    .returning();

  // Match to its call by phone number and time. The call may not exist yet (this webhook can fire mid-call).
  let callId = booking.callId;
  if (!callId) {
    const key = phoneKey(parsed.attendeePhone);
    if (key) {
      const recent = await db
        .select()
        .from(calls)
        .where(gte(calls.startedAt, new Date(Date.now() - 6 * 3_600_000)))
        .orderBy(desc(calls.startedAt));
      const match = recent.find((c) => phoneKey(c.callerPhone) === key);
      if (match) {
        callId = match.id;
        await db.update(bookings).set({ callId }).where(eq(bookings.id, booking.id));
      }
    }
  }

  if (callId) await afterBookingChange(db, callId, parsed);
  return { bookingId: booking.id, callId };
}

async function afterBookingChange(db: Db, callId: number, parsed: ParsedBooking) {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!call) return;

  if (parsed.event === "created") {
    // The Vaani webhook may already be in and waiting for this booking.
    await finishHandoff(db, callId);
    return;
  }

  const problems: string[] = [];
  if (call.hubspotDealId) {
    const dealId = call.hubspotDealId;
    try {
      if (parsed.event === "cancelled") await withRetry(() => hubspot.setDealStage(dealId, "cancelled"), 3);
      else
        await withRetry(
          () => hubspot.addNote("deals", dealId, `Consultation rescheduled to ${parsed.startsAt.toISOString()}`),
          3,
        );
    } catch (err) {
      problems.push(`HubSpot update: ${errorMessage(err)}`);
    }
  }
  if (parsed.event === "cancelled") problems.push("Consultation was cancelled. Follow up with the caller");
  if (problems.length) {
    await db
      .update(calls)
      .set({ needsAttention: true, errorText: problems.join(" | ") })
      .where(and(eq(calls.id, callId)));
  }
}
