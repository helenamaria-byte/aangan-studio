// All times shown to people are IST (Asia/Kolkata).

export interface OfficeHours {
  startHour: number; // 10 = 10:00
  endHour: number; // 19 = 19:00
  closedDays: number[]; // 0 = Sunday ... 6 = Saturday, in IST
}

export const DEFAULT_OFFICE_HOURS: OfficeHours = { startHour: 10, endHour: 19, closedDays: [0] };

const IST_OFFSET_MIN = 5 * 60 + 30;

function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    day: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

/** After hours = outside the office window, or on a closed day (Sunday by default). */
export function isAfterHours(d: Date, hours: OfficeHours = DEFAULT_OFFICE_HOURS): boolean {
  const { day, hour } = istParts(d);
  if (hours.closedDays.includes(day)) return true;
  return hour < hours.startHour || hour >= hours.endHour;
}

// ---- Periods for the dashboard (all boundaries are IST midnights) ----

export type Period = "today" | "week" | "month";

export interface PeriodRange {
  start: Date;
  end: Date; // now
  prevStart: Date;
  prevEnd: Date; // == start
  days: number; // length of the period in days (used to share monthly fixed costs)
  label: string; // "Today" | "This week" | "This month"
  prevLabel: string; // "yesterday" | "last week" | "last month"
}

const DAY = 86_400_000;
const OFFSET = IST_OFFSET_MIN * 60_000;

/** The IST midnight at or before d, as a real instant. */
function istMidnight(d: Date): Date {
  const shifted = d.getTime() + OFFSET;
  return new Date(Math.floor(shifted / DAY) * DAY - OFFSET);
}

/** Calendar date in IST as yyyy-mm-dd. */
export function istDateKey(d: Date): string {
  return new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
}

function istMonthStart(d: Date, monthDelta = 0): Date {
  const s = new Date(d.getTime() + OFFSET);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + monthDelta, 1) - OFFSET);
}

export function daysInIstMonth(d: Date): number {
  return Math.round((istMonthStart(d, 1).getTime() - istMonthStart(d).getTime()) / DAY);
}

export function periodRange(period: Period, now: Date): PeriodRange {
  if (period === "today") {
    const start = istMidnight(now);
    return { start, end: now, prevStart: new Date(start.getTime() - DAY), prevEnd: start, days: 1, label: "Today", prevLabel: "yesterday" };
  }
  if (period === "week") {
    const today = istMidnight(now);
    const dow = new Date(now.getTime() + OFFSET).getUTCDay(); // 0 = Sunday
    const start = new Date(today.getTime() - ((dow + 6) % 7) * DAY); // Monday
    return { start, end: now, prevStart: new Date(start.getTime() - 7 * DAY), prevEnd: start, days: 7, label: "This week", prevLabel: "last week" };
  }
  const start = istMonthStart(now);
  return { start, end: now, prevStart: istMonthStart(now, -1), prevEnd: start, days: daysInIstMonth(now), label: "This month", prevLabel: "last month" };
}

export function parsePeriod(v: string | string[] | undefined): Period {
  return v === "today" || v === "month" ? v : "week";
}

/** "Tue 14 Oct, 10:47 pm" */
export function formatIst(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}
