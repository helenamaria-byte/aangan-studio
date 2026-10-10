import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHandoffEmail } from "../src/lib/emails";
import { planActions } from "../src/lib/plan";
import { parseVaaniPayload } from "../src/lib/sources/vaani";
import { isAfterHours } from "../src/lib/time";

const DIR = join(__dirname, "fixtures");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const opts = { usdToInr: 85 };

const planLabel = (p: ReturnType<typeof planActions>) =>
  p.hubspot.kind === "deal" ? `deal:${p.hubspot.stage}` : p.hubspot.kind;

describe("fixtures: one fake Vaani payload per September phone transcript", () => {
  it("has all 20 transcripts", () => {
    for (let i = 1; i <= 20; i++) {
      const name = `T${String(i).padStart(2, "0")}.json`;
      expect(files, name).toContain(name);
    }
  });

  for (const f of files) {
    const payload = load(f);
    const exp = payload._expect;

    it(`${f}: outcome and routing match`, () => {
      const e = parseVaaniPayload(payload, opts);
      expect(e.outcome, "rule 2: every call has a logged outcome").toBe(exp.outcome);
      expect(e.declineReason).toBe(exp.declineReason);
      const plan = planActions(e);
      expect(planLabel(plan)).toBe(exp.plan.hubspot);
      expect(plan.emails).toEqual(exp.plan.emails);
    });
  }
});

describe("expected outcomes from section 8 of the spec", () => {
  const booked = ["T01", "T02", "T05", "T06", "T11", "T12", "T13", "T15", "T17", "T20"];
  const declined: Record<string, string> = {
    T03: "out_of_area",
    T04: "advice_only",
    T10: "budget",
    T18: "too_small",
    T19: "out_of_scope_type",
  };
  const e = (id: string) => parseVaaniPayload(load(`${id}.json`), opts);

  it.each(booked)("%s is qualified and booked", (id) => expect(e(id).outcome).toBe("qualified_booked"));

  it.each(Object.entries(declined))("%s is declined for %s", (id, reason) => {
    expect(e(id).outcome).toBe("declined");
    expect(e(id).declineReason).toBe(reason);
    expect(planActions(e(id)).emails, "declined leads get no email").toEqual([]);
  });

  it("T07 timeline too short is declined for timeline, with a later start offered", () => {
    expect(e("T07").declineReason).toBe("timeline");
    expect(e("T07").doubts).toMatch(/November start/);
  });

  it("T08 after-hours call is answered and logged, not missed", () => {
    const t08 = e("T08");
    expect(isAfterHours(t08.startedAt)).toBe(true);
    expect(t08.outcome).not.toBeNull();
  });

  it("T09 complaint alerts Nikhil and is not treated as a lead", () => {
    const plan = planActions(e("T09"));
    expect(plan.emails).toEqual(["complaint"]);
    expect(plan.hubspot.kind).toBe("note_on_existing");
    expect(plan.attention).toBeTruthy();
  });

  it("T14 son calling for parents: qualified, decision-maker represented, flagged", () => {
    const t14 = e("T14");
    expect(t14.outcome).toBe("qualified_booked");
    expect(t14.decisionMaker).toBe("represented");
    expect(t14.doubts).toMatch(/parents/i);
  });

  it("T16 repeat caller is flagged in the doubts", () => {
    expect(e("T16").doubts).toMatch(/repeat caller/i);
  });
});

describe("dropped, spam, and costs", () => {
  it("a dropped call under 60 seconds needs a callback", () => {
    expect(planActions(parseVaaniPayload(load("X01-dropped.json"), opts)).attention).toBe("Needs callback");
  });
  it("a dropped call over 60 seconds does not", () => {
    expect(planActions({ outcome: "dropped", durationSec: 72, declineReason: null }).attention).toBeNull();
  });
  it("an unreadable outcome is surfaced, never hidden", () => {
    expect(planActions({ outcome: null, durationSec: 100, declineReason: null }).attention).toMatch(/could not be read/);
  });
  it("a qualified lead with no booking shows under needs attention", () => {
    expect(planActions(parseVaaniPayload(load("X03-no-booking.json"), opts)).attention).toBeTruthy();
  });
  it("USD costs convert to rupees with the exchange rate", () => {
    const e = parseVaaniPayload(load("X04-usd-cost.json"), opts);
    expect(e.costs.voiceInr + e.costs.telephonyInr + e.costs.llmInr).toBeCloseTo(11.05, 2);
  });
  it("INR costs are used as they are", () => {
    expect(parseVaaniPayload(load("T01.json"), opts).costs.llmInr).toBe(0.8);
  });
});

describe("every booked handoff email is complete and price-free", () => {
  const booked = files.filter((f) => load(f)._expect.outcome === "qualified_booked");
  for (const f of booked) {
    it(`${f}: all fields present or marked unknown, no price figure`, () => {
      const e = parseVaaniPayload(load(f), opts);
      const mail = buildHandoffEmail({
        e,
        startsAt: new Date("2026-10-14T05:00:00Z"),
        locationType: "site",
        designerName: "Designer",
        hubspotDealUrl: "https://app.hubspot.com/contacts/1/deal/2",
        isRepeatCaller: false,
      });
      for (const label of [
        "Consultation:",
        "Caller:",
        "Property:",
        "What they want:",
        "Timeline:",
        "Decision-maker:",
        "Doubts or things to check:",
        "Already asked on the call. No need to ask again:",
      ]) {
        expect(mail.text, label).toContain(label);
      }
      expect(mail.text).not.toMatch(/undefined|null/);
      expect(mail.text).not.toMatch(/(₹|\bRs\.?\s)\s*\d/i);
      expect(mail.html).toContain("tel:");
    });
  }
});
