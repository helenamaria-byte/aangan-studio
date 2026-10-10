import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no type declarations
import { findLeaks } from "../scripts/check-pricing-leak.mjs";

const leaks = (agentLine: string): number => findLeaks(`Agent: ${agentLine}`).length;

describe("pricing-leak scanner", () => {
  it("passes the one allowed sentence", () => {
    expect(
      leaks(
        "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.",
      ),
    ).toBe(0);
  });

  it("passes ordinary talk, including numbers that are not money", () => {
    expect(leaks("Your consultation is on Tuesday 14 October at 10:30 am.")).toBe(0);
    expect(leaks("Execution takes 8 to 10 weeks from the start of design.")).toBe(0);
    expect(leaks("Is it a 3BHK of about 1,400 sq ft carpet?")).toBe(0);
    expect(leaks("Our commercial work goes up to 3,000 sq ft.")).toBe(0);
  });

  it.each([
    "It'll cost around 12 lakh for a flat like that.",
    "Our rates start at 1,800 per sq ft.",
    "For a 2BHK it's typically about eight to ten lakh.",
    "It would be roughly ₹15,00,000.",
    "Around Rs 2000 per square foot.",
    "Something like five lakh to seven lakh.",
    "Kitchens run to two lakh or so.",
    "Poora ghar ka kharcha lagbhag das lakh rupaye hoga.",
    "Dedh hazaar rupaye per square foot.",
    "Ballpark, you are looking at a good amount.",
    "Fifteen hundred per square foot.",
    "About two hundred a sq ft, I would say.",
    "The price is 40 lakh",
    "It is 1200 rupees a sq ft.",
  ])("fails: %s", (line) => {
    expect(leaks(line)).toBeGreaterThan(0);
  });

  it("only checks the agent's lines, never the caller's", () => {
    const t = "Caller: Is it around 10 lakh? Just a rough range.\nAgent: Pricing depends on the site, the materials you choose, and the scope.";
    expect(findLeaks(t)).toHaveLength(0);
  });

  it("reports the line number and the reason", () => {
    const t = "Caller: hi\nAgent: Sure.\nAgent: That would be about 5 lakh.";
    const r = findLeaks(t);
    expect(r).toHaveLength(1);
    expect(r[0].line).toBe(3);
  });
});
