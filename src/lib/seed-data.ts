import type { bookings, calls, designers } from "@/db/schema";

// A realistic month of demo data so the dashboard can be shown without live calls.
// Deterministic: the same `now` always gives the same data, so tests can check exact totals.

type CallInsert = typeof calls.$inferInsert;
type BookingInsert = typeof bookings.$inferInsert;
type DesignerInsert = typeof designers.$inferInsert;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_DESIGNERS: DesignerInsert[] = [
  { name: "Aryan Kulkarni", email: "aryan@example.invalid" },
  { name: "Mrunal Deshmukh", email: "mrunal@example.invalid" },
  { name: "Tanvi Bhide", email: "tanvi@example.invalid" },
  { name: "Rohan Gokhale", email: "rohan@example.invalid" },
  { name: "Isha Pathak", email: "isha@example.invalid" },
  { name: "Kunal Sathe", email: "kunal@example.invalid" },
];

const LOCALITIES = ["Kothrud", "Baner", "Aundh", "Wakad", "Koregaon Park", "Kalyani Nagar", "Viman Nagar", "Hadapsar", "Magarpatta", "NIBM", "Undri", "Pimple Saudagar", "Hinjewadi", "Ravet"];
const NAMES = ["Priya Joshi", "Anand Sharma", "Smita Rao", "Girish Nair", "Ritu Kapoor", "Pooja Mehta", "Aarti Menon", "Sunil Yadav", "Neha Deshpande", "Kiran Patil", "Meera Iyer", "Amol Patil", "Divya Hegde", "Siddharth Gupta", "Preethi Nair", "Chinmay Kulkarni", "Tanvi Kulkarni", "Vivek Rao"];
const DECLINES = ["out_of_area", "advice_only", "budget", "timeline", "too_small", "out_of_scope_type", "other"] as const;
const DECLINE_WEIGHTS = [0.25, 0.22, 0.2, 0.14, 0.08, 0.08, 0.03];

export interface SeedData {
  designers: DesignerInsert[];
  calls: CallInsert[];
  /** callIndex points into `calls`; designerIndex into `designers`. */
  bookings: (Omit<BookingInsert, "callId" | "designerId"> & { callIndex: number; designerIndex: number })[];
}

export function generateSeed(now: Date, days = 35): SeedData {
  const rand = rng(20261010);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const weighted = <T,>(xs: readonly T[], w: readonly number[]) => {
    let r = rand();
    for (let i = 0; i < xs.length; i++) if ((r -= w[i]) <= 0) return xs[i];
    return xs[xs.length - 1];
  };

  const callsOut: CallInsert[] = [];
  const bookingsOut: SeedData["bookings"] = [];
  let n = 0;
  let rr = 0; // round-robin designer

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(now.getTime() - d * 86_400_000);
    const perDay = 4 + Math.floor(rand() * 5); // about 6 a day, about 190 a month
    for (let i = 0; i < perDay; i++) {
      // One third of calls arrive after hours.
      const after = rand() < 0.33;
      const hourIst = after ? (rand() < 0.5 ? 19 + Math.floor(rand() * 5) : 6 + Math.floor(rand() * 4)) : 10 + Math.floor(rand() * 9);
      const min = Math.floor(rand() * 60);
      // IST wall-clock to an instant: build from the IST date of dayStart.
      const istDay = new Date(dayStart.getTime() + 330 * 60_000);
      const startedAt = new Date(Date.UTC(istDay.getUTCFullYear(), istDay.getUTCMonth(), istDay.getUTCDate(), hourIst, min) - 330 * 60_000);
      if (startedAt > now) continue;

      const r = rand();
      const outcome =
        r < 0.34 ? "qualified_booked"
        : r < 0.42 ? "qualified_no_booking"
        : r < 0.72 ? "declined"
        : r < 0.74 ? "complaint"
        : r < 0.84 ? "dropped"
        : "spam_or_wrong_number";

      const durationSec = outcome === "dropped" ? 15 + Math.floor(rand() * 40) : outcome === "spam_or_wrong_number" ? 10 + Math.floor(rand() * 20) : 120 + Math.floor(rand() * 330);
      const endedAt = new Date(startedAt.getTime() + durationSec * 1000);
      const isAfterHours = (() => {
        const dow = new Date(startedAt.getTime() + 330 * 60_000).getUTCDay();
        const h = new Date(startedAt.getTime() + 330 * 60_000).getUTCHours();
        return dow === 0 || h < 10 || h >= 19;
      })();

      const voice = Math.round(durationSec * 0.045 * 100) / 100;
      const telephony = Math.round(durationSec * 0.012 * 100) / 100;
      const llm = Math.round((0.4 + durationSec * 0.004) * 100) / 100;

      const named = outcome !== "dropped" && outcome !== "spam_or_wrong_number";
      const index = callsOut.length;
      const phone = `+9198${String(10_000_000 + Math.floor(rand() * 89_999_999))}`;

      callsOut.push({
        vaaniCallId: `seed-${++n}`,
        channel: "phone",
        startedAt,
        endedAt,
        durationSec,
        isAfterHours,
        callerPhone: phone,
        outcome,
        declineReason: outcome === "declined" ? weighted(DECLINES, DECLINE_WEIGHTS) : null,
        extractedFields: {
          callerName: named ? pick(NAMES) : null,
          locality: named ? pick(LOCALITIES) : null,
          propertyType: named ? pick(["apartment", "apartment", "villa", "house", "office"]) : null,
          scopeSummary: named ? "Kitchen, wardrobes and living room" : null,
        },
        summary:
          outcome === "qualified_booked" ? "Qualified, consultation booked on the call."
          : outcome === "qualified_no_booking" ? "Qualified. Preferred to be called back to pick a slot."
          : outcome === "declined" ? "Not a fit for the studio. Told politely."
          : outcome === "complaint" ? "Existing client unhappy about slow replies from the designer."
          : outcome === "dropped" ? "Line dropped early."
          : "Wrong number.",
        recordingUrl: `https://example.invalid/recordings/seed-${n}`,
        transcriptUrl: `https://example.invalid/transcripts/seed-${n}`,
        rawPayload: { seed: true },
        costVoiceInr: String(voice),
        costTelephonyInr: String(telephony),
        costLlmInr: String(llm),
        costEmailInr: "0",
        costTotalInr: String(Math.round((voice + telephony + llm) * 100) / 100),
        handoffSentAt:
          outcome === "qualified_booked" ? new Date(endedAt.getTime() + (60 + Math.floor(rand() * 180)) * 1000) : null,
        needsAttention: false,
        errorText: null,
        handledAt: null,
      });

      if (outcome === "qualified_booked") {
        const daysAhead = 2 + Math.floor(rand() * 9);
        const startsAt = new Date(endedAt.getTime() + daysAhead * 86_400_000);
        const past = startsAt < now;
        bookingsOut.push({
          calcomBookingId: `seed-booking-${index}`,
          callIndex: index,
          designerIndex: rr++ % SEED_DESIGNERS.length,
          startsAt,
          attendeePhone: phone,
          status: past ? (rand() < 0.1 ? "cancelled" : "completed") : "booked",
        });
      }
    }
  }

  // Leave a few things on the "Needs attention" list so the dashboard shows what it is for.
  const recent = (pred: (c: CallInsert) => boolean) => [...callsOut].reverse().find(pred);
  const complaint = recent((c) => c.outcome === "complaint");
  if (complaint) Object.assign(complaint, { needsAttention: true, errorText: "Complaint not yet handled" });
  const lead = recent((c) => c.outcome === "qualified_no_booking");
  if (lead) Object.assign(lead, { needsAttention: true, errorText: "Qualified lead with no booking yet" });
  const dropped = recent((c) => c.outcome === "dropped");
  if (dropped) Object.assign(dropped, { needsAttention: true, errorText: "Needs callback" });
  const failed = recent((c) => c.outcome === "qualified_booked");
  if (failed) Object.assign(failed, { needsAttention: true, errorText: "Handoff email: Resend 500", handoffSentAt: null });

  return { designers: SEED_DESIGNERS, calls: callsOut, bookings: bookingsOut };
}
