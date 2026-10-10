import type {
  DeclineReason,
  Enquiry,
  Outcome,
  PropertyType,
} from "../enquiry";

// Vaani's real webhook shape is not confirmed yet. This is the shape we ASSUME, and it is the only
// place that needs to change when Vaani's docs say otherwise. Every field is read defensively.
// TODO: check Vaani's webhook docs and adjust the paths below.
//
//   { event, call_id, started_at, ended_at, duration_seconds, from_number,
//     transcript, transcript_url, recording_url,
//     cost: { currency: "INR"|"USD", voice, telephony, llm },
//     analysis: { ...fields from agent/post-call-fields.md } }

const OUTCOMES: Outcome[] = [
  "qualified_booked",
  "qualified_no_booking",
  "declined",
  "complaint",
  "dropped",
  "spam_or_wrong_number",
];
const DECLINE: DeclineReason[] = [
  "advice_only",
  "out_of_area",
  "timeline",
  "budget",
  "out_of_scope_type",
  "too_small",
  "other",
];
const PROPERTY: PropertyType[] = ["apartment", "house", "villa", "office", "clinic", "other"];

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj {
  return v && typeof v === "object" ? (v as Obj) : {};
}
function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}
function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = str(v)?.toLowerCase();
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}
function date(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface AdapterOptions {
  usdToInr: number;
}

/** Throws if the payload has no call ID or start time. The caller stores the raw payload before calling this. */
export function parseVaaniPayload(raw: unknown, opts: AdapterOptions): Enquiry {
  const p = asObj(raw);
  const a = asObj(p.analysis);
  const cost = asObj(p.cost);

  const sourceId = str(p.call_id);
  if (!sourceId) throw new Error("Vaani payload has no call_id");
  const startedAt = date(p.started_at);
  if (!startedAt) throw new Error("Vaani payload has no valid started_at");

  const rate = str(cost.currency)?.toUpperCase() === "USD" ? opts.usdToInr : 1;
  const money = (v: unknown) => Math.round((num(v) ?? 0) * rate * 100) / 100;

  const decisionRaw = str(a.decision_maker)?.toLowerCase();
  const decisionMaker =
    decisionRaw === "yes" || decisionRaw === "represented" || decisionRaw === "unclear"
      ? decisionRaw
      : null;

  return {
    channel: "phone",
    sourceId,
    startedAt,
    endedAt: date(p.ended_at),
    durationSec: num(p.duration_seconds),
    callerName: str(a.caller_name),
    callerPhone: str(a.caller_phone) ?? str(p.from_number),
    locality: str(a.locality),
    propertyType: pick(a.property_type, PROPERTY),
    sizeSqft: num(a.size_sqft),
    scopeSummary: str(a.scope_summary),
    timelineText: str(a.timeline_text),
    decisionMaker,
    budgetMentioned: str(a.budget_mentioned),
    outcome: pick(a.outcome, OUTCOMES),
    declineReason: pick(a.decline_reason, DECLINE),
    doubts: str(a.doubts),
    language: str(a.language),
    summary: str(a.summary),
    transcriptUrl: str(p.transcript_url),
    recordingUrl: str(p.recording_url),
    costs: { voiceInr: money(cost.voice), telephonyInr: money(cost.telephony), llmInr: money(cost.llm) },
    raw,
  };
}
