import { describe, expect, it } from "vitest";
import { createLoginToken, createSessionToken, readLoginToken, readSessionToken } from "../src/lib/auth";
import { formatInr, formatInrShort } from "../src/lib/format";
import { generateSeed } from "../src/lib/seed-data";
import { DEFAULT_FIXED_COSTS, type AppSettings } from "../src/lib/settings";
import {
  attentionItems,
  callsPerDay,
  afterHoursShare,
  callsToCsv,
  costByMonth,
  declineReasons,
  filterCalls,
  funnel,
  homeStats,
  medianMinutesToDesigner,
  toCallView,
  type CallRow,
  type CallView,
} from "../src/lib/stats";
import { DEFAULT_OFFICE_HOURS, daysInIstMonth, istDateKey, periodRange } from "../src/lib/time";

process.env.AUTH_SECRET = "test-secret-with-enough-length-1234";

// "Now" is a Saturday in IST: 10 Oct 2026, 11:00.
const NOW = new Date("2026-10-10T05:30:00Z");

const settings: AppSettings = {
  officeHours: DEFAULT_OFFICE_HOURS,
  usdToInr: 85,
  frontDeskEmail: null,
  ownerEmail: null,
  averageProjectValueInr: 1_100_000,
  fixedMonthlyCostsInr: { vercel: 1700, neon: 1600, hubspot: 3200, calcom: 1000, resend: 1700 },
  users: [],
  studioPhone: null,
};
const FIXED_TOTAL = 1700 + 1600 + 3200 + 1000 + 1700;

const seed = generateSeed(NOW);
const rows: CallRow[] = seed.calls.map((c, i) => ({ id: i + 1, createdAt: NOW, hubspotContactId: null, hubspotDealId: null, ...c }) as unknown as CallRow);
const views: CallView[] = rows.map(toCallView);

describe("seed data", () => {
  it("is deterministic and about a month's worth", () => {
    expect(JSON.stringify(generateSeed(NOW).calls.map((c) => c.vaaniCallId))).toBe(JSON.stringify(seed.calls.map((c) => c.vaaniCallId)));
    expect(seed.calls.length).toBeGreaterThan(150);
    expect(seed.calls.length).toBeLessThan(260);
  });
  it("has roughly a third of calls after hours, and every outcome represented", () => {
    const share = seed.calls.filter((c) => c.isAfterHours).length / seed.calls.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
    const outcomes = new Set(seed.calls.map((c) => c.outcome));
    for (const o of ["qualified_booked", "qualified_no_booking", "declined", "complaint", "dropped", "spam_or_wrong_number"]) {
      expect(outcomes.has(o)).toBe(true);
    }
  });
});

describe("cost numbers match the sum of per-call costs plus fixed costs", () => {
  it("this month: total = sum of every call's cost this month + the full monthly fixed costs", () => {
    const r = periodRange("month", NOW);
    const monthCalls = views.filter((c) => c.startedAt >= r.start && c.startedAt <= NOW);
    const perCall = monthCalls.reduce((a, c) => a + c.costTotal, 0);

    const s = homeStats(views, settings, "month", NOW);
    expect(s.callCostInr).toBeCloseTo(perCall, 6);
    expect(s.fixedShareInr).toBeCloseTo(FIXED_TOTAL, 6);
    expect(s.totalCostInr).toBeCloseTo(perCall + FIXED_TOTAL, 6);
  });

  it("each call's total is voice + phone line + AI", () => {
    for (const c of views) expect(c.costTotal).toBeCloseTo(c.costVoice + c.costTelephony + c.costLlm, 1);
  });

  it("this week: fixed costs are shared by days (7 of the month's days)", () => {
    const s = homeStats(views, settings, "week", NOW);
    expect(s.fixedShareInr).toBeCloseTo((FIXED_TOTAL * 7) / daysInIstMonth(NOW), 6);
    expect(s.totalCostInr).toBeCloseTo(s.callCostInr + s.fixedShareInr, 6);
  });

  it("cost per booked consultation = total cost / booked, and is null with no bookings", () => {
    const s = homeStats(views, settings, "month", NOW);
    expect(s.costPerBookedInr).toBeCloseTo(s.totalCostInr / s.booked, 6);
    expect(homeStats([], settings, "week", NOW).costPerBookedInr).toBeNull();
  });

  it("monthly report equals the same per-call sums, split by tool", () => {
    const months = costByMonth(views, settings, NOW, 3);
    const thisMonth = months[months.length - 1];
    const calls = views.filter((c) => istDateKey(c.startedAt).startsWith(thisMonth.key));
    expect(thisMonth.phone).toBeCloseTo(calls.reduce((a, c) => a + c.costVoice + c.costTelephony, 0), 6);
    expect(thisMonth.ai).toBeCloseTo(calls.reduce((a, c) => a + c.costLlm, 0), 6);
    expect(thisMonth.software).toBe(FIXED_TOTAL);
    expect(thisMonth.total).toBeCloseTo(thisMonth.phone + thisMonth.ai + thisMonth.software, 6);
  });

  it("with no fixed costs set, the total is only the per-call costs", () => {
    const s = homeStats(views, { ...settings, fixedMonthlyCostsInr: DEFAULT_FIXED_COSTS }, "month", NOW);
    expect(s.totalCostInr).toBeCloseTo(s.callCostInr, 6);
  });
});

describe("home page numbers", () => {
  it("counts answered, after-hours and booked for the period, and compares with the one before", () => {
    const r = periodRange("week", NOW);
    const inWeek = views.filter((c) => c.startedAt >= r.start && c.startedAt <= NOW);
    const prevWeek = views.filter((c) => c.startedAt >= r.prevStart && c.startedAt < r.prevEnd);
    const s = homeStats(views, settings, "week", NOW);
    expect(s.total).toBe(inWeek.length);
    expect(s.afterHours).toBe(inWeek.filter((c) => c.isAfterHours).length);
    expect(s.booked).toBe(inWeek.filter((c) => c.outcome === "qualified_booked").length);
    expect(s.prevBooked).toBe(prevWeek.filter((c) => c.outcome === "qualified_booked").length);
    expect(s.pipelineInr).toBe(s.booked * 1_100_000);
  });

  it("the week starts on Monday (IST) and 'today' starts at IST midnight", () => {
    expect(istDateKey(periodRange("week", NOW).start)).toBe("2026-10-05");
    expect(periodRange("today", NOW).start.toISOString()).toBe("2026-10-09T18:30:00.000Z");
    expect(istDateKey(periodRange("month", NOW).start)).toBe("2026-10-01");
    expect(istDateKey(periodRange("month", NOW).prevStart)).toBe("2026-09-01");
  });
});

describe("needs attention", () => {
  it("lists flagged calls, complaints first, and hides handled ones", () => {
    const items = attentionItems(views, NOW);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items[0].kind).toBe("complaint");
    const handled = views.map((c) => (c.outcome === "complaint" ? { ...c, handledAt: NOW } : c));
    expect(attentionItems(handled, NOW).some((i) => i.kind === "complaint")).toBe(false);
  });

  it("a booked call whose designer email is still missing after 5 minutes shows up even if nothing flagged it", () => {
    const base = views.find((c) => c.outcome === "qualified_booked" && c.handoffSentAt && !c.needsAttention)!;
    const stale = { ...base, handoffSentAt: null, startedAt: new Date(NOW.getTime() - 6 * 60_000) };
    const fresh = { ...base, handoffSentAt: null, startedAt: new Date(NOW.getTime() - 2 * 60_000) };
    expect(attentionItems([stale], NOW)).toHaveLength(1);
    expect(attentionItems([fresh], NOW)).toHaveLength(0);
  });

  it("is empty when everything is fine", () => {
    expect(attentionItems(views.map((c) => ({ ...c, needsAttention: false })).filter((c) => c.outcome !== "qualified_booked" || c.handoffSentAt), NOW)).toHaveLength(0);
  });
});

describe("reports", () => {
  it("calls per day covers 30 days and the after-hours share adds up", () => {
    const days = callsPerDay(views, NOW, 30);
    expect(days).toHaveLength(30);
    const { after, total } = afterHoursShare(days);
    const windowKeys = new Set(days.map((d) => d.key));
    const inWindow = views.filter((c) => windowKeys.has(istDateKey(c.startedAt)));
    expect(total).toBe(inWindow.length);
    expect(after).toBe(inWindow.filter((c) => c.isAfterHours).length);
  });

  it("funnel steps never grow as they go down", () => {
    const f = funnel(views, []);
    expect(f.answered).toBeGreaterThanOrEqual(f.qualified);
    expect(f.qualified).toBeGreaterThanOrEqual(f.booked);
  });

  it("decline reasons add up to the declined calls", () => {
    expect(declineReasons(views).reduce((a, d) => a + d.count, 0)).toBe(views.filter((c) => c.outcome === "declined").length);
  });

  it("median time from call end to designer email is a few minutes in the seed data", () => {
    const m = medianMinutesToDesigner(views)!;
    expect(m).toBeGreaterThan(0.5);
    expect(m).toBeLessThan(5);
  });
});

describe("calls list", () => {
  it("filters by outcome, hours, dates and free text", () => {
    expect(filterCalls(views, { outcome: "complaint" }).every((c) => c.outcome === "complaint")).toBe(true);
    expect(filterCalls(views, { hours: "after" }).every((c) => c.isAfterHours)).toBe(true);
    expect(filterCalls(views, { hours: "day" }).every((c) => !c.isAfterHours)).toBe(true);
    const named = views.find((c) => c.callerName)!;
    expect(filterCalls(views, { q: named.callerName!.toUpperCase() }).length).toBeGreaterThan(0);
    expect(filterCalls(views, { from: NOW }).length).toBe(0);
  });

  it("CSV export hides costs for the front desk and defuses spreadsheet formulas", () => {
    const evil: CallView = { ...views[0], callerName: "=HYPERLINK(\"http://x\")", summary: "line one, \"quoted\"" };
    const owner = callsToCsv([evil], true);
    const desk = callsToCsv([evil], false);
    expect(owner).toContain("Cost (INR)");
    expect(desk).not.toContain("Cost");
    expect(owner).toContain("'=HYPERLINK");
    expect(owner).toContain('"line one, ""quoted"""');
  });
});

describe("Indian formats", () => {
  it("uses lakh and crore grouping", () => {
    expect(formatInr(124500)).toBe("₹1,24,500");
    expect(formatInr(12345678)).toBe("₹1,23,45,678");
    expect(formatInr(176.4)).toBe("₹176");
  });
  it("shortens to lakh and crore", () => {
    expect(formatInrShort(120000)).toBe("₹1.2 lakh");
    expect(formatInrShort(1_100_000)).toBe("₹11 lakh");
    expect(formatInrShort(15_400_000)).toBe("₹1.5 crore");
    expect(formatInrShort(8200)).toBe("₹8,200");
  });
});

describe("sign-in tokens", () => {
  const t0 = Date.parse("2026-10-10T00:00:00Z");
  it("a login link works for 15 minutes, then expires", () => {
    const token = createLoginToken("Nikhil@Example.test", t0);
    expect(readLoginToken(token, t0 + 14 * 60_000)).toBe("nikhil@example.test");
    expect(readLoginToken(token, t0 + 16 * 60_000)).toBeNull();
  });
  it("a session lasts 30 days", () => {
    const token = createSessionToken("a@b.test", t0);
    expect(readSessionToken(token, t0 + 29 * 86_400_000)).toBe("a@b.test");
    expect(readSessionToken(token, t0 + 31 * 86_400_000)).toBeNull();
  });
  it("a login link cannot be used as a session, or the other way round", () => {
    expect(readSessionToken(createLoginToken("a@b.test", t0), t0)).toBeNull();
    expect(readLoginToken(createSessionToken("a@b.test", t0), t0)).toBeNull();
  });
  it("a tampered or malformed token is rejected", () => {
    const token = createSessionToken("a@b.test", t0);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "session", e: "owner@x.test", x: t0 + 1e12 })).toString("base64url");
    expect(readSessionToken(`${forged}.${sig}`, t0)).toBeNull();
    expect(readSessionToken(`${body}.AAAA`, t0)).toBeNull();
    expect(readSessionToken("garbage", t0)).toBeNull();
    expect(readSessionToken(undefined, t0)).toBeNull();
  });
});
