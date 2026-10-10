import type { Enquiry } from "../enquiry";

// Vaani's end-of-call webhook (call_postprocessing) does not carry the caller's number or the cost.
// Vaani's call-history API does (docs.vaanivoice.ai/api-reference/call-history). Needs VAANI_API_KEY
// (created in the Vaani dashboard), sent as the X-API-Key header.

const BASE = "https://api.vaanivoice.ai/api";

export interface VaaniCallRecord {
  callerPhone: string | null;
  /** Vaani reports cost in credits. */
  creditCost: number | null;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The person on the other end. For an inbound call that is from_number, for an outbound call it is to_number. */
export function callerFromRecord(rec: Obj): string | null {
  const dir = `${str(rec.direction) ?? ""} ${str(rec.call_type) ?? ""}`.toLowerCase();
  const inbound = /\bin(bound|coming)?\b/.test(dir);
  const meta = asObj(rec.call_metadata);
  return (inbound ? str(rec.from_number) : str(rec.to_number)) ?? str(meta.phone) ?? str(rec.from_number);
}

/** Finds one call in the history. Throws if it is not there yet, so the caller can retry (post-processing can lag). */
export async function fetchCallRecord(callId: string, apiKey: string): Promise<VaaniCallRecord> {
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE}/call-history?page=${page}&page_size=200`, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) throw new Error(`Vaani call history ${res.status}`);
    const body = asObj(await res.json());
    const rows = Array.isArray(body.data) ? (body.data as Obj[]) : [];
    const rec = rows.find((r) => r.call_id === callId);
    if (rec) {
      const cost = typeof rec.call_cost === "number" ? rec.call_cost : null;
      return { callerPhone: callerFromRecord(rec), creditCost: cost };
    }
    if (!asObj(body.pagination).has_next) break;
  }
  throw new Error(`Call ${callId} is not in Vaani's call history yet`);
}

/** Fills in what the webhook left out. Never overwrites a value the webhook did give. */
export function applyCallRecord(e: Enquiry, rec: VaaniCallRecord, creditToInr: number): Enquiry {
  const noCost = e.costs.voiceInr + e.costs.telephonyInr + e.costs.llmInr === 0;
  return {
    ...e,
    // Caller ID is more reliable than a number the caller spoke aloud, so it wins for matching and CRM.
    callerPhone: rec.callerPhone ?? e.callerPhone,
    costs:
      noCost && rec.creditCost !== null
        ? { ...e.costs, voiceInr: Math.round(rec.creditCost * creditToInr * 100) / 100 }
        : e.costs,
  };
}
