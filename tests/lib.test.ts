import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseCalcom } from "../src/lib/calcom";
import { buildComplaintEmail, buildFrontDeskEmail, buildHandoffEmail } from "../src/lib/emails";
import type { Enquiry } from "../src/lib/enquiry";
import { phoneKey, toE164 } from "../src/lib/phone";
import { withRetry } from "../src/lib/retry";
import { formatIst, isAfterHours } from "../src/lib/time";
import { verifyCalcom, verifyCron, verifyVaani } from "../src/lib/verify";

const base: Enquiry = {
  channel: "phone",
  sourceId: "x",
  startedAt: new Date("2026-09-19T05:08:00Z"),
  endedAt: null,
  durationSec: 300,
  callerName: "Girish Nair",
  callerPhone: "+919800000016",
  locality: "Viman Nagar",
  propertyType: "apartment",
  sizeSqft: null,
  scopeSummary: "3BHK",
  timelineText: null,
  decisionMaker: "yes",
  budgetMentioned: null,
  outcome: "qualified_booked",
  declineReason: null,
  doubts: null,
  language: "English",
  summary: "s",
  transcriptUrl: null,
  recordingUrl: "https://example.invalid/r",
  costs: { voiceInr: 0, telephonyInr: 0, llmInr: 0 },
  raw: null,
};
const handoff = (e: Enquiry, repeat = false) =>
  buildHandoffEmail({
    e,
    startsAt: new Date("2026-10-14T05:00:00Z"),
    locationType: "site",
    designerName: "Aryan",
    hubspotDealUrl: null,
    isRepeatCaller: repeat,
  });

describe("office hours (IST)", () => {
  it("10:00 to 19:00 Mon-Sat is office hours", () => {
    expect(isAfterHours(new Date("2026-09-02T04:53:00Z"))).toBe(false); // Wed 10:23 IST
    expect(isAfterHours(new Date("2026-09-02T13:29:00Z"))).toBe(false); // Wed 18:59 IST
  });
  it("before 10 and from 19:00 is after hours", () => {
    expect(isAfterHours(new Date("2026-09-02T04:29:00Z"))).toBe(true); // 09:59 IST
    expect(isAfterHours(new Date("2026-09-02T13:30:00Z"))).toBe(true); // 19:00 IST
  });
  it("Sunday is after hours all day", () => {
    expect(isAfterHours(new Date("2026-09-06T06:30:00Z"))).toBe(true); // Sun 12:00 IST
  });
  it("uses IST, not UTC, to decide the day", () => {
    expect(isAfterHours(new Date("2026-09-05T20:00:00Z"))).toBe(true); // Sat 20:00 UTC is Sun 01:30 IST
  });
  it("formats like 'Wed 14 Oct, 10:47 pm'", () => {
    expect(formatIst(new Date("2026-10-14T17:17:00Z"))).toBe("Wed 14 Oct, 10:47 pm");
  });
});

describe("handoff email", () => {
  it("subject follows the spec", () => {
    expect(handoff(base).subject).toBe("New consultation: Girish Nair, apartment in Viman Nagar, Wed 14 Oct, 10:30 am");
  });
  it("marks unknown fields instead of dropping them", () => {
    const m = handoff({ ...base, callerName: null, sizeSqft: null, timelineText: null });
    expect(m.text).toContain("Timeline: Not captured on the call");
    expect(m.subject).toContain("New caller");
  });
  it("shows budget only when the caller said one", () => {
    expect(handoff(base).text).not.toContain("Budget");
    expect(handoff({ ...base, budgetMentioned: "about 8 lakh" }).text).toContain(
      "Budget mentioned by caller: about 8 lakh",
    );
  });
  it("flags a repeat caller", () => {
    expect(handoff(base, true).text).toMatch(/Repeat caller/);
  });
  it("escapes HTML from caller-supplied text", () => {
    expect(handoff({ ...base, scopeSummary: "<script>alert(1)</script>" }).html).not.toContain("<script>");
  });
});

describe("other emails", () => {
  it("complaint subject starts with Urgent:", () => {
    const m = buildComplaintEmail(
      { ...base, outcome: "complaint", summary: "Existing client; designer Aryan has not replied." },
      null,
    );
    expect(m.subject.startsWith("Urgent:")).toBe(true);
    expect(m.text).toContain("Designer: Aryan");
    expect(m.text).toContain("Phone: +919800000016");
  });
  it("front desk email asks for a human booking", () => {
    expect(buildFrontDeskEmail({ ...base, outcome: "qualified_no_booking" }, null).text).toMatch(
      /book the consultation/,
    );
  });
});

describe("webhook verification", () => {
  const body = '{"a":1}';
  const sig = (s: string) => createHmac("sha256", s).update(body).digest("hex");
  it("Vaani: rejects when no secret is configured", () => {
    expect(verifyVaani(body, new Headers({ "x-vaani-secret": "anything" }), undefined)).toBe(false);
  });
  it("Vaani: accepts the shared secret and a valid signature, rejects wrong ones", () => {
    expect(verifyVaani(body, new Headers({ "x-vaani-secret": "s3" }), "s3")).toBe(true);
    expect(verifyVaani(body, new Headers({ "x-vaani-secret": "bad" }), "s3")).toBe(false);
    expect(verifyVaani(body, new Headers({ "x-vaani-signature": `sha256=${sig("s3")}` }), "s3")).toBe(true);
    expect(verifyVaani(body, new Headers({ "x-vaani-signature": sig("other") }), "s3")).toBe(false);
    expect(verifyVaani(body, new Headers(), "s3")).toBe(false);
  });
  it("Cal.com: checks the HMAC of the raw body", () => {
    expect(verifyCalcom(body, new Headers({ "x-cal-signature-256": sig("c") }), "c")).toBe(true);
    expect(verifyCalcom('{"a":2}', new Headers({ "x-cal-signature-256": sig("c") }), "c")).toBe(false);
    expect(verifyCalcom(body, new Headers(), "c")).toBe(false);
  });
  it("cron: needs the bearer secret", () => {
    expect(verifyCron(new Headers({ authorization: "Bearer k" }), "k")).toBe(true);
    expect(verifyCron(new Headers({ authorization: "Bearer z" }), "k")).toBe(false);
    expect(verifyCron(new Headers(), undefined)).toBe(false);
  });
});

describe("phone matching", () => {
  it("matches the same number written differently", () => {
    expect(phoneKey("+91 98000 00016")).toBe(phoneKey("09800000016"));
    expect(toE164("98000-00016")).toBe("+919800000016");
  });
  it("returns null for junk", () => {
    expect(phoneKey("123")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe("retry", () => {
  it("retries up to 3 times then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("a")).mockRejectedValueOnce(new Error("b")).mockResolvedValue("ok");
    await expect(withRetry(fn, 3, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("gives up after 3 failures and throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRetry(fn, 3, 1)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("Cal.com payload", () => {
  const payload = (trigger: string) => ({
    triggerEvent: trigger,
    payload: {
      uid: "abc",
      startTime: "2026-10-14T05:00:00Z",
      organizer: { email: "d@aangan.in", name: "Aryan" },
      attendees: [{ name: "Priya", phoneNumber: "+919800000001" }],
      location: "Client site",
    },
  });
  it("reads a created booking", () => {
    expect(parseCalcom(payload("BOOKING_CREATED"))).toMatchObject({
      event: "created",
      uid: "abc",
      organizerEmail: "d@aangan.in",
      attendeePhone: "+919800000001",
      locationType: "site",
    });
  });
  it("reads cancellations and reschedules", () => {
    expect(parseCalcom(payload("BOOKING_CANCELLED"))!.event).toBe("cancelled");
    expect(parseCalcom(payload("BOOKING_RESCHEDULED"))!.event).toBe("rescheduled");
  });
  it("ignores other events and rejects a booking with no id", () => {
    expect(parseCalcom({ triggerEvent: "PING", payload: {} })).toBeNull();
    expect(() => parseCalcom({ triggerEvent: "BOOKING_CREATED", payload: {} })).toThrow();
  });
});
