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
