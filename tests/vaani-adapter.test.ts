import { describe, expect, it } from "vitest";
import { parseVaaniPayload } from "../src/lib/sources/vaani";

const opts = { usdToInr: 85 };
const analysis = {
  caller_name: "Priya",
  locality: "Kothrud",
  property_type: "apartment",
  size_sqft: "1,400",
  outcome: "Qualified Booked", // the way a model might write it
  decision_maker: "yes",
  summary: "Booked.",
};

describe("Vaani adapter tolerates likely payload shapes (the real one is confirmed on the first test call)", () => {
  it("reads our assumed shape", () => {
    const e = parseVaaniPayload(
      { call_id: "a1", started_at: "2026-10-12T04:30:00Z", ended_at: "2026-10-12T04:34:00Z", duration_seconds: 240, from_number: "+919800000001", cost: { voice: 5, telephony: 2, llm: 1 }, analysis },
      opts,
    );
    expect(e).toMatchObject({ sourceId: "a1", durationSec: 240, callerName: "Priya", outcome: "qualified_booked", sizeSqft: 1400 });
    expect(e.costs).toEqual({ voiceInr: 5, telephonyInr: 2, llmInr: 1 });
  });

  it("reads the call out of an envelope such as { event, data: {...} }", () => {
    const e = parseVaaniPayload(
      { event: "call.completed", data: { id: "b2", start_time: "2026-10-12T04:30:00Z", caller_number: "+919800000002", analysis } },
      opts,
    );
    expect(e.sourceId).toBe("b2");
    expect(e.callerPhone).toBe("+919800000002");
    expect(e.outcome).toBe("qualified_booked");
  });

  it("reads other field names for id, times, duration, number and recording", () => {
    const e = parseVaaniPayload(
      { call_uuid: "c3", startTime: "2026-10-12T04:30:00Z", endTime: "2026-10-12T04:33:30Z", customer_number: "+919800000003", recordingUrl: "https://r/1", post_call_analysis: analysis },
      opts,
    );
    expect(e.sourceId).toBe("c3");
    expect(e.durationSec).toBe(210); // worked out from start and end
    expect(e.callerPhone).toBe("+919800000003");
    expect(e.recordingUrl).toBe("https://r/1");
  });

  it("reads timestamps given as seconds or milliseconds since 1970", () => {
    const sec = parseVaaniPayload({ call_id: "d4", started_at: 1_791_779_400 }, opts);
    const ms = parseVaaniPayload({ call_id: "d5", started_at: "1791779400000" }, opts);
    expect(sec.startedAt.toISOString()).toBe("2026-10-12T04:30:00.000Z");
    expect(ms.startedAt.toISOString()).toBe("2026-10-12T04:30:00.000Z");
  });

  it("reads analysis fields from a nested object or a list of name/value pairs", () => {
    const nested = parseVaaniPayload({ call_id: "e6", started_at: "2026-10-12T04:30:00Z", analysis: { summary: "x", data: analysis } }, opts);
    expect(nested.callerName).toBe("Priya");
    const list = parseVaaniPayload(
      { call_id: "e7", started_at: "2026-10-12T04:30:00Z", extracted_data: Object.entries(analysis).map(([name, value]) => ({ name, value })) },
      opts,
    );
    expect(list.locality).toBe("Kothrud");
    expect(list.outcome).toBe("qualified_booked");
  });

  it("treats a single total cost as the call's cost, and converts dollars", () => {
    expect(parseVaaniPayload({ call_id: "f8", started_at: "2026-10-12T04:30:00Z", cost: 12.5 }, opts).costs).toEqual({ voiceInr: 12.5, telephonyInr: 0, llmInr: 0 });
    const usd = parseVaaniPayload({ call_id: "f9", started_at: "2026-10-12T04:30:00Z", total_cost: 0.1, currency: "USD" }, opts);
    expect(usd.costs.voiceInr).toBeCloseTo(8.5, 2);
  });

  it("uses the caller's number from caller ID when the analysis has none", () => {
    expect(parseVaaniPayload({ call_id: "g1", started_at: "2026-10-12T04:30:00Z", from: "+919800000009" }, opts).callerPhone).toBe("+919800000009");
  });

  it("gives a clear error, naming what it looked for, when the call id or time cannot be found", () => {
    expect(() => parseVaaniPayload({ hello: "world" }, opts)).toThrow(/no call id/);
    expect(() => parseVaaniPayload({ call_id: "h1" }, opts)).toThrow(/no readable start time/);
  });
});
