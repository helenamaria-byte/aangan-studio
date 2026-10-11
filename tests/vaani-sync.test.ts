import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs module, no type declarations
import { analysisBody, dataPoints, knowledgeFiles, personaBody, stripTodos, systemPrompt, verify } from "../scripts/lib/vaani-agent.mjs";
import { parseVaaniPayload } from "../src/lib/sources/vaani";

type Check = [string, boolean, string];

describe("what the sync sends to Vaani", () => {
  const prompt: string = systemPrompt();

  it("contains the pricing rule word for word, and never a price figure", () => {
    expect(prompt).toContain("Pricing depends on the site, the materials you choose, and the scope.");
    expect(prompt).not.toMatch(/(₹|\bRs\.?|\bINR)\s*\d/i);
    expect(prompt).not.toMatch(/\d[\d.,]*\s*(lakhs?|lacs?|crores?)\b/i);
    expect(prompt).not.toMatch(/\d\s*(per|\/)\s*sq/i);
  });

  it("never leaks our internal to-do notes to the voice agent", () => {
    expect(prompt).not.toMatch(/TODO/);
    expect(prompt).not.toMatch(/Nikhil:/);
    for (const k of knowledgeFiles() as { text: string }[]) expect(k.text).not.toMatch(/TODO/);
  });

  it("includes the studio facts, so the agent knows its services and service area without a knowledge base", () => {
    expect(prompt).toContain("Studio facts");
    expect(prompt).toMatch(/Pimple Saudagar/);
    expect(prompt).toMatch(/Restaurants, hotels, retail stores and gyms/);
    expect(prompt).toMatch(/under 6 weeks/);
  });

  it("strips to-do notes from a line without touching the rest of it", () => {
    expect(stripTodos("Offices up to 3,000 sq ft. TODO for Nikhil: confirm the minimum. Includes cabins.\nTODO for Nikhil: whole line\nNext")).toBe(
      "Offices up to 3,000 sq ft.\nNext",
    );
  });

  it("sends the prompt and greeting as Vaani's persona, and the fields as its extraction setup", () => {
    expect(personaBody().identity.system_prompt).toBe(prompt);
    expect(personaBody().identity.greeting_message.agent_message).toMatch(/Aangan Studio/);
    expect(analysisBody().extraction.data_collection.enabled).toBe(true);
    expect(analysisBody().extraction.data_collection.data_points).toHaveLength(14);
  });
});

describe("the 14 extraction fields", () => {
  const names: string[] = dataPoints.map((d: { name: string }) => d.name);

  it("fit Vaani's 30-character limit and have a prompt each", () => {
    for (const d of dataPoints as { name: string; prompt: string }[]) {
      expect(d.name.length, d.name).toBeLessThanOrEqual(30);
      expect(d.prompt.length, d.name).toBeGreaterThan(10);
    }
  });

  it("use exactly the names the app reads after each call", () => {
    const entities = Object.fromEntries(names.map((n) => [n, "x"]));
    entities.property_type = "apartment";
    entities.decision_maker = "yes";
    entities.outcome = "qualified_booked";
    entities.decline_reason = "other";
    entities.size_sqft = "900";
    const e = parseVaaniPayload(
      { event: "call_postprocessing", call_id: "c1", timestamp: "2026-10-12T04:34:00Z", data: { call_duration: 60000, entities } },
      { usdToInr: 85 },
    );
    expect(e).toMatchObject({
      callerName: "x", callerPhone: "x", locality: "x", propertyType: "apartment", sizeSqft: 900, scopeSummary: "x",
      timelineText: "x", decisionMaker: "yes", budgetMentioned: "x", outcome: "qualified_booked", declineReason: "other",
      doubts: "x", language: "x", summary: "x",
    });
  });

  it("offer every outcome and decline reason the app understands", () => {
    const outcome = dataPoints.find((d: { name: string }) => d.name === "outcome");
    expect(outcome.values).toEqual(["qualified_booked", "qualified_no_booking", "declined", "complaint", "dropped", "spam_or_wrong_number"]);
    const reason = dataPoints.find((d: { name: string }) => d.name === "decline_reason");
    expect(reason.values).toEqual(["advice_only", "out_of_area", "timeline", "budget", "out_of_scope_type", "too_small", "other"]);
  });
});

describe("checking that Vaani really saved it", () => {
  const prompt: string = systemPrompt();
  const good = {
    persona: { identity: { system_prompt: prompt } },
    analysis: { extraction: { data_collection: { enabled: true, data_points: dataPoints } } },
  };
  const failed = (c: Check[]) => c.filter(([, ok]) => !ok).map(([l]) => l);

  it("passes when everything is stored", () => {
    expect(failed(verify(good, prompt.length))).toEqual([]);
  });
  it("fails when the prompt is empty (what happened to the first agent)", () => {
    const empty = { ...good, persona: { identity: { system_prompt: "" } } };
    expect(failed(verify(empty, prompt.length))).toEqual(expect.arrayContaining(["system prompt saved", "prompt contains the pricing rule"]));
  });
  it("fails when extraction is off or fields are missing, and names what is missing", () => {
    const off = { ...good, analysis: { extraction: { data_collection: { enabled: false, data_points: [] } } } };
    const c = verify(off, prompt.length) as Check[];
    expect(failed(c)).toEqual(expect.arrayContaining(["extraction turned on", "all 14 extraction fields saved"]));
    expect(c.find(([l]) => l.startsWith("all 14"))![2]).toMatch(/caller_name/);
  });
});
