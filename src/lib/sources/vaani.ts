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
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}
function str(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}
function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, "_");
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}
/** ISO strings, or a number of seconds or milliseconds since 1970. */
function date(v: unknown): Date | null {
  const asNumber = typeof v === "number" ? v : typeof v === "string" && /^\d{9,13}(\.\d+)?$/.test(v.trim()) ? Number(v) : null;
  const d = asNumber !== null ? new Date(asNumber < 1e11 ? asNumber * 1000 : asNumber) : new Date(str(v) ?? "");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Vaani (app.vaanivoice.ai) sends several webhook events. The one we act on is "call_postprocessing", sent once the
// transcript and analysis are ready (docs.vaanivoice.ai/guides/webhook-setup):
//   { event, call_id, timestamp, data: { room_name, call_id, call_duration (milliseconds), end_reason, summary,
//     entities: { ...the fields we define in the agent's entity extraction }, dispositions, recording_url, transcript } }
// It does NOT include the caller's number, the start time, or the cost. The number and cost come from Vaani's
// call-history API (see ../clients/vaani-api.ts); the start time is worked out as timestamp minus duration.
// Other field names are still accepted too, in case Vaani changes the format, and the raw payload is always saved.
const KEYS = {
  id: ["call_id", "callId", "id", "call_uuid", "call_sid", "uuid", "conversation_id", "session_id"],
  start: ["started_at", "start_time", "Start_time", "startedAt", "startTime", "call_start_time", "start_timestamp", "created_at"],
  end: ["ended_at", "end_time", "End_time", "endedAt", "endTime", "call_end_time", "end_timestamp"],
  eventTime: ["timestamp"],
  duration: ["duration_seconds", "duration_sec", "duration", "call_duration", "call_duration_seconds", "durationSeconds"],
  durationMs: ["duration_ms"],
  from: ["from_number", "from", "caller_number", "customer_number", "caller", "customer_phone", "phone_number", "caller_id"],
  recording: ["recording_url", "recordingUrl", "call_recording_url", "recording_api", "recording"],
  transcriptUrl: ["transcript_url", "transcriptUrl", "call_transcription"],
  analysis: ["entities", "entity", "call_entity", "analysis", "post_call_analysis", "call_analysis", "extracted_data", "structured_data", "extraction"],
  cost: ["cost", "costs", "billing", "pricing"],
  totalCost: ["call_cost", "total_cost", "cost_total"],
  currency: ["currency", "cost_currency"],
} as const;
const WRAPPERS = ["data", "call", "payload", "body", "event_data", "message"];
const NESTED_FIELDS = ["data", "structured_data", "extracted_data", "custom_data", "fields", "variables"];

function get(o: Obj, keys: readonly string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
}

/** Top-level fields plus the fields of the first wrapper object that looks like the call record. */
function unwrap(raw: unknown): Obj {
  const top = asObj(raw);
  let p = top;
  if (!get(top, KEYS.id)) {
    for (const w of WRAPPERS) {
      const inner = asObj(top[w]);
      if (get(inner, KEYS.id)) {
        p = { ...top, ...inner };
        break;
      }
    }
  }
  // Vaani puts the call's details under "data" even though the call id is also at the top.
  const data = asObj(p.data);
  return Object.keys(data).length ? { ...p, ...data, event: p.event ?? data.event } : p;
}

/** The post-call analysis as a flat object. Accepts an object, an object with a nested fields object, or a list of {name, value}. */
function analysisBag(p: Obj): Obj {
  const candidate = get(p, KEYS.analysis);
  let a: Obj = {};
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const o = asObj(item);
      const k = str(o.name ?? o.key ?? o.field ?? o.label);
      if (k) a[k] = o.value ?? o.answer ?? o.result;
    }
  } else {
    a = asObj(candidate);
  }
  const bag: Obj = { ...a };
  for (const n of NESTED_FIELDS) {
    const nested = asObj(a[n]);
    for (const [k, v] of Object.entries(nested)) if (bag[k] === undefined) bag[k] = v;
  }
  return bag;
}

/**
 * Vaani's extraction returns free text for decline_reason even when told to pick from a list
 * (a real call returned a sentence about Nashik). Accept the exact code, otherwise read the sentence.
 */
export function normalizeDeclineReason(v: unknown): DeclineReason | null {
  const exact = pick(v, DECLINE);
  if (exact) return exact;
  const t = str(v)?.toLowerCase();
  if (!t) return null;
  if (/restaurant|hotel|retail|shop|gym|hospitality|structural|architect|vastu|furniture only|out of scope/.test(t)) return "out_of_scope_type";
  if (/nashik|mumbai|outside (the )?(pune|service|our)|out of (the )?(service )?area|not in pune|other city|beyond (pune|pcmc)/.test(t)) return "out_of_area";
  if (/advice|ideas|suggestion|styling|decor|consultation only|just looking/.test(t)) return "advice_only";
  if (/timeline|too soon|short notice|urgent|deadline|weeks?/.test(t)) return "timeline";
  if (/budget|too low|afford|too little/.test(t)) return "budget";
  if (/too small|minimum|below (our )?(minimum|scope)|small(er)? (space|project)/.test(t)) return "too_small";
  return "other";
}

export interface AdapterOptions {
  usdToInr: number;
  /** Rupees per Vaani credit (Vaani reports call cost in credits). */
  creditToInr?: number;
}

/** Throws if the payload has no call ID or start time. The caller stores the raw payload before calling this. */
export function parseVaaniPayload(raw: unknown, opts: AdapterOptions): Enquiry {
  const p = unwrap(raw);
  const a = analysisBag(p);

  const sourceId = str(get(p, KEYS.id));
  if (!sourceId) throw new Error("Vaani payload has no call id (looked for call_id, id, call_uuid and similar)");
  // Duration. Vaani's documentation says call_postprocessing reports call_duration in milliseconds, but real calls
  // report SECONDS (a 63-second call arrived as 63.36). So: a duration_ms field is milliseconds; for call_duration,
  // anything under 10,000 is seconds (up to 2.7 hours) and anything larger is milliseconds.
  const msField = num(get(p, KEYS.durationMs));
  const callDuration = num(p.call_duration);
  let durationSec: number | null;
  if (msField !== null) durationSec = Math.round(msField / 1000);
  else if (callDuration !== null && str(p.event) === "call_postprocessing") durationSec = Math.round(callDuration >= 10_000 ? callDuration / 1000 : callDuration);
  else durationSec = num(get(p, KEYS.duration));

  // Times. With no start time, the event's own timestamp is treated as the end of the call, and the start is
  // worked out from the duration.
  let startedAt = date(get(p, KEYS.start));
  let endedAt = date(get(p, KEYS.end));
  const eventTime = date(get(p, KEYS.eventTime));
  if (!startedAt && eventTime && durationSec !== null) {
    endedAt ??= eventTime;
    startedAt = new Date(endedAt.getTime() - durationSec * 1000);
  }
  if (!startedAt && eventTime) startedAt = eventTime;
  if (!startedAt) throw new Error("Vaani payload has no readable start time (looked for started_at, start_time, timestamp and similar)");
  if (durationSec === null && endedAt) durationSec = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  // Costs: an object of parts, or one total number.
  const costRaw = get(p, KEYS.cost);
  const cost = asObj(costRaw);
  const creditRate = opts.creditToInr ?? 1;
  const credits = num(p.call_cost); // Vaani reports cost in credits
  const total = credits !== null ? credits * creditRate : (num(costRaw) ?? num(get(p, KEYS.totalCost)) ?? num(cost.total ?? cost.total_cost ?? cost.amount));
  const voiceRaw = num(cost.voice ?? cost.voice_cost ?? cost.stt_tts ?? cost.agent);
  const telephonyRaw = num(cost.telephony ?? cost.telephony_cost ?? cost.phone ?? cost.carrier);
  const llmRaw = num(cost.llm ?? cost.llm_cost ?? cost.ai);
  const hasParts = voiceRaw !== null || telephonyRaw !== null || llmRaw !== null;
  const currency = str(cost.currency ?? get(p, KEYS.currency))?.toUpperCase();
  const rate = currency === "USD" ? opts.usdToInr : 1;
  const money = (v: number | null) => Math.round((v ?? 0) * rate * 100) / 100;

  const decisionRaw = str(a.decision_maker)?.toLowerCase();
  const decisionMaker =
    decisionRaw === "yes" || decisionRaw === "represented" || decisionRaw === "unclear" ? decisionRaw : null;

  return {
    channel: "phone",
    sourceId,
    startedAt,
    endedAt,
    durationSec,
    callerName: str(a.caller_name),
    callerPhone: str(a.caller_phone) ?? str(get(p, KEYS.from)),
    locality: str(a.locality),
    propertyType: pick(a.property_type, PROPERTY),
    sizeSqft: num(a.size_sqft),
    scopeSummary: str(a.scope_summary),
    timelineText: str(a.timeline_text),
    decisionMaker,
    budgetMentioned: str(a.budget_mentioned),
    outcome: pick(a.outcome, OUTCOMES),
    declineReason: normalizeDeclineReason(a.decline_reason),
    doubts: str(a.doubts),
    language: str(a.language),
    summary: str(a.summary) ?? str(p.summary) ?? str(p.call_summary),
    transcriptUrl: str(get(p, KEYS.transcriptUrl)),
    recordingUrl: str(get(p, KEYS.recording)),
    costs: hasParts
      ? { voiceInr: money(voiceRaw), telephonyInr: money(telephonyRaw), llmInr: money(llmRaw) }
      : { voiceInr: money(total), telephonyInr: 0, llmInr: 0 },
    raw,
  };
}

/**
 * Vaani sends many events (call_started, call_ringing, call_ended, human_transfer_*, call_postprocessing...).
 * Only call_postprocessing has the transcript and our extracted fields. A payload with no "event" at all is
 * processed, so a different or older format is never silently dropped.
 */
export function shouldProcessEvent(raw: unknown): boolean {
  const ev = str(asObj(raw).event);
  return ev === null || ev === "call_postprocessing";
}
