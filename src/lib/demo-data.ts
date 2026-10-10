import { generateSeed, SEED_DESIGNERS } from "./seed-data";
import type { AppSettings } from "./settings";
import { DEFAULT_OFFICE_HOURS } from "./time";
import { toCallView, type BookingRow, type CallRow, type CallView } from "./stats";

// The public /demo pages run on this built-in sample data. They never touch the database, so they can be shown
// to anyone without exposing real callers. The data is relative to "now" and the same every time on a given day.

export interface DemoData {
  calls: CallView[];
  rows: CallRow[];
  bookings: BookingRow[];
  designers: { id: number; name: string; email: string }[];
  settings: AppSettings;
}

export function getDemoData(now: Date = new Date()): DemoData {
  // Round to the start of the hour so every page in one visit sees identical data.
  const at = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  const seed = generateSeed(at);

  const rows = seed.calls.map(
    (c, i) =>
      ({
        id: i + 1,
        createdAt: c.startedAt,
        hubspotContactId: null,
        hubspotDealId: null,
        handledAt: null,
        ...c,
      }) as unknown as CallRow,
  );

  const designers = SEED_DESIGNERS.map((d, i) => ({ id: i + 1, name: d.name, email: d.email }));

  const bookings = seed.bookings.map(
    (b, i) =>
      ({
        id: i + 1,
        calcomBookingId: b.calcomBookingId,
        callId: b.callIndex + 1,
        designerId: b.designerIndex + 1,
        startsAt: b.startsAt,
        attendeePhone: b.attendeePhone ?? null,
        attendeeName: null,
        locationType: i % 3 === 0 ? "studio" : "site",
        createdAt: b.startsAt,
        status: b.status ?? "booked",
      }) as BookingRow,
  );

  const settings: AppSettings = {
    officeHours: DEFAULT_OFFICE_HOURS,
    usdToInr: 85,
    frontDeskEmail: null,
    ownerEmail: null,
    averageProjectValueInr: 1_100_000,
    fixedMonthlyCostsInr: { vercel: 1700, neon: 1600, hubspot: 3200, calcom: 1000, resend: 1700 },
    users: [],
    studioPhone: "+91 20 0000 0000",
  };

  return { calls: rows.map(toCallView), rows, bookings, designers, settings };
}
