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

describe("Vaani's documented call_postprocessing event (docs.vaanivoice.ai/guides/webhook-setup)", () => {
  const documented = {
    event: "call_postprocessing",
    call_id: "inbound-1791779640-ab12cd34",
    timestamp: "2026-10-12T04:34:00Z",
    data: {
      room_name: "room_123abc",
      call_id: "inbound-1791779640-ab12cd34",
      call_duration: 240000, // milliseconds in this event
      end_reason: "USER_DISCONNECT",
      summary: "Priya wants a full 3BHK redesign. Booked.",
      entities: { ...analysis, summary: undefined, caller_phone: "+919800000001" }, // no summary field, so Vaani's own summary is used
      dispositions: { outcome: "Booked" },
      recording_url: "https://api.vaanivoice.ai/api/stream/inbound-1791779640-ab12cd34",
      transcript: "AGENT: Good morning, Aangan Studio.\nUSER: Hi, I want to redo my flat.",
    },
  };

  it("reads the call, with the duration in milliseconds and the start worked out from the event time", () => {
    const e = parseVaaniPayload(documented, opts);
    expect(e.sourceId).toBe("inbound-1791779640-ab12cd34");
    expect(e.durationSec).toBe(240);
    expect(e.endedAt!.toISOString()).toBe("2026-10-12T04:34:00.000Z");
    expect(e.startedAt.toISOString()).toBe("2026-10-12T04:30:00.000Z");
    expect(e.callerName).toBe("Priya");
    expect(e.outcome).toBe("qualified_booked");
    expect(e.sizeSqft).toBe(1400);
    expect(e.callerPhone).toBe("+919800000001"); // from the extracted field, until call history supplies caller ID
    expect(e.summary).toBe("Priya wants a full 3BHK redesign. Booked.");
    expect(e.recordingUrl).toContain("/api/stream/");
  });

  it("has no cost in the webhook, so the cost starts at zero (call history fills it in)", () => {
    expect(parseVaaniPayload(documented, opts).costs).toEqual({ voiceInr: 0, telephonyInr: 0, llmInr: 0 });
  });

  it("converts Vaani credits to rupees when a cost is present", () => {
    const e = parseVaaniPayload({ ...documented, call_cost: 2.3 }, { usdToInr: 85, creditToInr: 4 });
    expect(e.costs.voiceInr).toBeCloseTo(9.2, 2);
  });

  it("only call_postprocessing is processed. Every other Vaani event is ignored", async () => {
    const { shouldProcessEvent } = await import("../src/lib/sources/vaani");
    expect(shouldProcessEvent(documented)).toBe(true);
    for (const ev of ["call_started", "call_ringing", "user_picked_up_at", "call_ended", "human_transfer_initiated", "human_transfer_successful", "human_transfer_failed", "call_failed", "call_rejected", "call_no_answer"]) {
      expect(shouldProcessEvent({ event: ev, room_name: "r" }), ev).toBe(false);
    }
    expect(shouldProcessEvent({ call_id: "no-event-field" })).toBe(true); // an unknown format is never silently dropped
  });
});

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
