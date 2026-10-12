import type { bookings, calls } from "@/db/schema";
import type { AppSettings, FixedCosts } from "./settings";
import { daysInIstMonth, istDateKey, periodRange, type Period } from "./time";

// Pure functions: rows in, numbers out. Every dashboard figure comes from here so it can be tested.

export type CallRow = typeof calls.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;

export interface CallView {
  id: number;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  isAfterHours: boolean;
  callerPhone: string | null;
  callerName: string | null;
  locality: string | null;
  propertyType: string | null;
  scopeSummary: string | null;
  outcome: string | null;
  declineReason: string | null;
  summary: string | null;
  costVoice: number;
  costTelephony: number;
  costLlm: number;
  costTotal: number;
  handoffSentAt: Date | null;
  needsAttention: boolean;
  handledAt: Date | null;
  errorText: string | null;
  hubspotDealId: string | null;
  hubspotContactId: string | null;
  assignedDesignerId: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
}

export function toCallView(r: CallRow): CallView {
  const f = (r.extractedFields ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : null);
  return {
    id: r.id,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationSec: r.durationSec,
    isAfterHours: r.isAfterHours,
    callerPhone: r.callerPhone,
    callerName: s("callerName"),
    locality: s("locality"),
    propertyType: s("propertyType"),
    scopeSummary: s("scopeSummary"),
    outcome: r.outcome,
    declineReason: r.declineReason,
    summary: r.summary,
    costVoice: Number(r.costVoiceInr ?? 0),
    costTelephony: Number(r.costTelephonyInr ?? 0),
    costLlm: Number(r.costLlmInr ?? 0),
    costTotal: Number(r.costTotalInr ?? 0),
    handoffSentAt: r.handoffSentAt,
    needsAttention: r.needsAttention,
    handledAt: r.handledAt,
    errorText: r.errorText,
    hubspotDealId: r.hubspotDealId,
    hubspotContactId: r.hubspotContactId,
    assignedDesignerId: r.assignedDesignerId ?? null,
    recordingUrl: r.recordingUrl,
    transcriptUrl: r.transcriptUrl,
  };
}

const inRange = (d: Date, start: Date, end: Date) => d >= start && d < end;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sumFixed = (f: FixedCosts) => sum(Object.values(f));

// ---------------------------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------------------------

export interface HomeStats {
  period: Period;
  label: string;
  prevLabel: string;
  total: number;
  answered: number;
  afterHours: number;
  booked: number;
  prevBooked: number;
  pipelineInr: number;
  callCostInr: number;
  fixedShareInr: number;
  totalCostInr: number;
  costPerBookedInr: number | null;
}

export function homeStats(all: CallView[], settings: AppSettings, period: Period, now: Date): HomeStats {
  const r = periodRange(period, now);
  const cur = all.filter((c) => inRange(c.startedAt, r.start, new Date(r.end.getTime() + 1)));
  const prev = all.filter((c) => inRange(c.startedAt, r.prevStart, r.prevEnd));

  const booked = cur.filter((c) => c.outcome === "qualified_booked").length;
  const callCostInr = sum(cur.map((c) => c.costTotal));
  const fixedShareInr = (sumFixed(settings.fixedMonthlyCostsInr) * r.days) / daysInIstMonth(now);
  const totalCostInr = callCostInr + fixedShareInr;

  return {
    period,
    label: r.label,
    prevLabel: r.prevLabel,
    total: cur.length,
    // A call with zero seconds never connected. Everything else was picked up by the agent.
    answered: cur.filter((c) => c.durationSec === null || c.durationSec > 0).length,
    afterHours: cur.filter((c) => c.isAfterHours).length,
    booked,
    prevBooked: prev.filter((c) => c.outcome === "qualified_booked").length,
    pipelineInr: booked * settings.averageProjectValueInr,
    callCostInr,
    fixedShareInr,
    totalCostInr,
    costPerBookedInr: booked ? totalCostInr / booked : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------------------------

export type AttentionKind = "complaint" | "no_booking" | "callback" | "failure";
export type Audience = "owner" | "front_desk" | "designer";

export interface AttentionItem {
  call: CallView;
  kind: AttentionKind;
  /** Plain words for a person. Technical details never appear here. */
  message: string;
}

const HANDOFF_GRACE_MS = 5 * 60_000;

/** A detail that is simply missing is not a problem to show anyone. */
const isMissingDetail = (t: string | null) => Boolean(t && /^No caller phone number|^Call outcome could not be read/.test(t));

function failureMessage(c: CallView, stale: boolean): string | null {
  if (isMissingDetail(c.errorText) && !stale) return null;
  if (c.errorText?.startsWith("Could not read this call")) return "A call could not be read. Please open it";
  if (stale || /^Handoff/i.test(c.errorText ?? "")) return "The designer's note has not gone out yet";
  return "Something did not go out. Try again";
}

/**
 * What needs a person, written for that person. Owners see everything. The front desk sees complaints, leads and
 * callbacks. A designer sees only new leads of their own. Raw errors are never shown here.
 */
export function attentionItems(all: CallView[], now: Date, audience: Audience = "owner"): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of all) {
    if (c.handledAt) continue;

    const staleHandoff =
      c.outcome === "qualified_booked" && !c.handoffSentAt && now.getTime() - c.startedAt.getTime() > HANDOFF_GRACE_MS;

    if (!c.needsAttention && !staleHandoff) continue;

    if (c.outcome === "complaint") {
      if (audience !== "designer") items.push({ call: c, kind: "complaint", message: "Complaint from an existing client" });
    } else if (c.outcome === "qualified_no_booking") {
      items.push({ call: c, kind: "no_booking", message: "New lead. No consultation booked yet" });
    } else if (c.outcome === "dropped") {
      // Only worth showing when there is a number to ring back.
      if (audience !== "designer" && c.callerPhone) items.push({ call: c, kind: "callback", message: "Missed call. Worth a quick callback" });
    } else if (audience === "owner") {
      const message = failureMessage(c, staleHandoff);
      if (message) items.push({ call: c, kind: "failure", message });
    }
  }
  // Complaints first, then oldest first, so nothing waits quietly at the bottom.
  const rank: Record<AttentionKind, number> = { complaint: 0, failure: 1, no_booking: 2, callback: 3 };
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || a.call.startedAt.getTime() - b.call.startedAt.getTime());
}

/** Keep only the leads given to one designer. null means everything. */
export function scopeCalls(all: CallView[], designerId: number | null): CallView[] {
  return designerId === null ? all : all.filter((c) => c.assignedDesignerId === designerId);
}

// ---------------------------------------------------------------------------------------------
// A designer's own numbers
// ---------------------------------------------------------------------------------------------

export interface DesignerStats {
  label: string;
  leads: number;
  booked: number;
  waiting: number;
}

/** Counts for one designer's leads (pass the calls already limited to them). */
export function designerStats(mine: CallView[], period: Period, now: Date): DesignerStats {
  const r = periodRange(period, now);
  const inPeriod = mine.filter((c) => inRange(c.startedAt, r.start, new Date(r.end.getTime() + 1)));
  const leads = inPeriod.filter((c) => c.outcome === "qualified_booked" || c.outcome === "qualified_no_booking");
  return {
    label: r.label,
    leads: leads.length,
    booked: leads.filter((c) => c.outcome === "qualified_booked").length,
    // Leads still waiting for a consultation to be booked, whenever they came in.
    waiting: mine.filter((c) => c.outcome === "qualified_no_booking" && !c.handledAt).length,
  };
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

export interface DayBucket {
  key: string; // yyyy-mm-dd (IST)
  office: number;
  after: number;
}

export function callsPerDay(all: CallView[], now: Date, days = 30): DayBucket[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(istDateKey(new Date(now.getTime() - i * 86_400_000)));
  const map = new Map(keys.map((k) => [k, { key: k, office: 0, after: 0 }]));
  for (const c of all) {
    const b = map.get(istDateKey(c.startedAt));
    if (!b) continue;
    if (c.isAfterHours) b.after++;
    else b.office++;
  }
  return keys.map((k) => map.get(k)!);
}

export function afterHoursShare(buckets: DayBucket[]): { share: number; after: number; total: number } {
  const after = sum(buckets.map((b) => b.after));
  const total = after + sum(buckets.map((b) => b.office));
  return { share: total ? after / total : 0, after, total };
}

export interface Funnel {
  answered: number;
  qualified: number;
  booked: number;
  held: number;
}

export function funnel(all: CallView[], bookingRows: BookingRow[]): Funnel {
  return {
    answered: all.filter((c) => c.durationSec === null || c.durationSec > 0).length,
    qualified: all.filter((c) => c.outcome === "qualified_booked" || c.outcome === "qualified_no_booking").length,
    booked: all.filter((c) => c.outcome === "qualified_booked").length,
    held: bookingRows.filter((b) => b.status === "completed").length,
  };
}

export const DECLINE_LABELS: Record<string, string> = {
  advice_only: "Wanted advice only",
  out_of_area: "Outside Pune and PCMC",
  timeline: "Timeline too short",
  budget: "Budget too low for the scope",
  out_of_scope_type: "Type of space we do not do",
  too_small: "Space too small",
  other: "Other",
};

export function declineReasons(all: CallView[]): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of all) {
    if (c.outcome !== "declined") continue;
    const k = c.declineReason ?? "other";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: DECLINE_LABELS[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Median minutes from the end of a call to the designer's email, for booked calls. */
export function medianMinutesToDesigner(all: CallView[]): number | null {
  const mins = all
    .filter((c) => c.outcome === "qualified_booked" && c.handoffSentAt)
    .map((c) => {
      const end = c.endedAt ?? new Date(c.startedAt.getTime() + (c.durationSec ?? 0) * 1000);
      return Math.max(0, (c.handoffSentAt!.getTime() - end.getTime()) / 60_000);
    })
    .sort((a, b) => a - b);
  if (!mins.length) return null;
  const mid = Math.floor(mins.length / 2);
  return mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
}

export interface MonthCost {
  key: string; // yyyy-mm
  label: string;
  phone: number; // voice + telephony
  ai: number;
  software: number; // fixed plans
  total: number;
  booked: number;
  perBooked: number | null;
}

export function costByMonth(all: CallView[], settings: AppSettings, now: Date, months = 6): MonthCost[] {
  const fixed = sumFixed(settings.fixedMonthlyCostsInr);
  const nowParts = istDateKey(now).split("-").map(Number);
  const out: MonthCost[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowParts[0], nowParts[1] - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const rows = all.filter((c) => istDateKey(c.startedAt).startsWith(key));
    const phone = sum(rows.map((c) => c.costVoice + c.costTelephony));
    const ai = sum(rows.map((c) => c.costLlm));
    const booked = rows.filter((c) => c.outcome === "qualified_booked").length;
    const total = phone + ai + fixed;
    out.push({
      key,
      label: d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }),
      phone,
      ai,
      software: fixed,
      total,
      booked,
      perBooked: booked ? total / booked : null,
    });
  }
  return out;
}

export function bookingsByDesigner(
  rows: BookingRow[],
  designerRows: { id: number; name: string }[],
): { name: string; count: number }[] {
  const names = new Map(designerRows.map((d) => [d.id, d.name]));
  const counts = new Map<string, number>();
  for (const b of rows) {
    if (b.status === "cancelled") continue;
    const n = (b.designerId && names.get(b.designerId)) || "Unassigned";
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------------------------
// Calls list filters and CSV
// ---------------------------------------------------------------------------------------------

export interface CallFilters {
  q?: string;
  outcome?: string;
  hours?: "day" | "after";
  from?: Date;
  to?: Date;
}

export function filterCalls(all: CallView[], f: CallFilters): CallView[] {
  const q = f.q?.trim().toLowerCase();
  return all.filter((c) => {
    if (f.outcome && c.outcome !== f.outcome) return false;
    if (f.hours === "day" && c.isAfterHours) return false;
    if (f.hours === "after" && !c.isAfterHours) return false;
    if (f.from && c.startedAt < f.from) return false;
    if (f.to && c.startedAt >= f.to) return false;
    if (q) {
      const hay = [c.callerName, c.callerPhone, c.locality, c.summary, c.scopeSummary].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const OUTCOME_LABELS: Record<string, string> = {
  qualified_booked: "Booked",
  qualified_no_booking: "Lead",
  declined: "Declined",
  complaint: "Complaint",
  dropped: "Dropped",
  spam_or_wrong_number: "Wrong number",
};

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  // Quote when needed, and defuse spreadsheet formulas typed by callers (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function callsToCsv(rows: CallView[], includeCosts: boolean): string {
  const head = ["Date and time (IST)", "Name", "Phone", "Locality", "Outcome", "Decline reason", "After hours", "Duration (sec)", "Summary", ...(includeCosts ? ["Cost (INR)"] : [])];
  const lines = [head.map(csvCell).join(",")];
  for (const c of rows) {
    lines.push(
      [
        new Date(c.startedAt.getTime() + 330 * 60_000).toISOString().replace("T", " ").slice(0, 16),
        c.callerName,
        c.callerPhone,
        c.locality,
        OUTCOME_LABELS[c.outcome ?? ""] ?? "Unknown",
        c.declineReason ? (DECLINE_LABELS[c.declineReason] ?? c.declineReason) : null,
        c.isAfterHours ? "Yes" : "No",
        c.durationSec,
        c.summary,
        ...(includeCosts ? [Math.round(c.costTotal * 100) / 100] : []),
      ]
        .map((v) => csvCell(v as string | number | null))
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
