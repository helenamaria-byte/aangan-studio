// Generates tests/fixtures/*.json: one fake Vaani end-of-call payload per September phone transcript (T01-T20),
// plus a few synthetic edge cases. Run: npm run gen:fixtures
// The payload shape is the one ASSUMED in src/lib/sources/vaani.ts. Update both together once Vaani's docs are checked.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures");
mkdirSync(OUT, { recursive: true });

// id, IST date + time, seconds, phone, analysis fields, notes
const D = (id, when, sec, phone, a, expect = {}) => ({ id, when, sec, phone, a, expect });

const fixtures = [
  D("T01", "2026-09-02T10:23", 252, "+919800000001", { caller_name: "Priya", locality: "Kothrud, Dahanukar Colony", property_type: "apartment", size_sqft: 1400, scope_summary: "Full redo of a 3BHK: kitchen, living room, both bedrooms", timeline_text: "Done by March, no rush", decision_maker: "yes", outcome: "qualified_booked", doubts: "Husband not on the call but knows and agrees", language: "English", summary: "Referred by a past client. Full 3BHK redesign, booked." }),
  D("T02", "2026-09-03T14:41", 308, "+919800000002", { caller_name: null, locality: "Wakad", property_type: "apartment", size_sqft: 950, scope_summary: "Full redesign: modular kitchen, wardrobes, living room, both bedrooms", timeline_text: "Moving in November, design from October", decision_maker: "yes", outcome: "qualified_booked", doubts: "Pushed twice for a price range. None given", language: "English", summary: "Asked for a ballpark twice and was deflected. Booked." }, { priceDeflected: true }),
  D("T03", "2026-09-03T16:15", 160, "+919800000003", { caller_name: "Suresh Patil", locality: "Nashik", property_type: "house", scope_summary: "Home office and study", outcome: "declined", decline_reason: "out_of_area", language: "English", summary: "Site is in Nashik, outside Pune and PCMC." }),
  D("T04", "2026-09-04T11:07", 202, "+919800000004", { caller_name: null, locality: null, property_type: "apartment", scope_summary: "Ideas on colours and furniture arrangement for a living room", outcome: "declined", decline_reason: "advice_only", language: "English", summary: "Wants suggestions only, no execution." }),
  D("T05", "2026-09-05T10:52", 404, "+919800000005", { caller_name: "Aarti Mehta", locality: "Koregaon Park", property_type: "apartment", size_sqft: 2400, scope_summary: "Complete redesign of a 4BHK: new flooring, kitchen, four bedrooms", timeline_text: "Move back by February", decision_maker: "yes", outcome: "qualified_booked", doubts: "Referred through a friend of Nikhil's. Site visit requested", language: "English", summary: "Large 4BHK, family already moved out. Site visit booked." }),
  D("T06", "2026-09-05T15:28", 301, "+919800000006", { caller_name: null, locality: "Baner", property_type: "office", size_sqft: 800, scope_summary: "Bare-shell office fitout: 20 workstations, a cabin, a meeting room, a break area", timeline_text: "Operational by December", decision_maker: "yes", outcome: "qualified_booked", doubts: "Caller is the founder", language: "English", summary: "Startup's first office, bare shell. Booked." }),
  D("T07", "2026-09-08T09:44", 195, "+919800000007", { caller_name: null, locality: null, property_type: "apartment", scope_summary: "Living room and kitchen before Diwali", timeline_text: "Before Diwali, about three weeks away", outcome: "declined", decline_reason: "timeline", doubts: "Offered a November start. Said they would think and call back", language: "English", summary: "Needs it in three weeks. Told 8 to 10 weeks minimum. Offered a later start." }),
  D("T08", "2026-09-09T22:47", 140, "+919800000008", { caller_name: null, locality: "Nanded City", property_type: null, scope_summary: null, outcome: "qualified_no_booking", doubts: "Nanded City is not on the confirmed service-area list. Team to confirm and call back", language: "English", summary: "After-hours call, answered. Area unconfirmed, so no booking made." }, { afterHours: true }),
  D("T09", "2026-09-10T11:32", 352, "+919800000009", { caller_name: "Sheetal Deshpande", locality: "Viman Nagar", property_type: "apartment", scope_summary: "Existing client, 2BHK", outcome: "complaint", doubts: "Wants a callback from Nikhil or a senior person", language: "English", summary: "Existing client; designer Aryan has not replied in five days. Three messages and two calls unanswered." }),
  D("T10", "2026-09-11T14:04", 220, "+919800000010", { caller_name: null, locality: "Kharadi", property_type: "apartment", size_sqft: 550, scope_summary: "Kitchen and one bedroom in a 1BHK", budget_mentioned: "1 to 1.5 lakh maximum for everything", outcome: "declined", decline_reason: "budget", language: "English", summary: "Volunteered a budget well below what the scope needs. Told gently." }),
  D("T11", "2026-09-12T10:18", 382, "+919800000011", { caller_name: null, locality: "Baner", property_type: "apartment", scope_summary: "Living room, bedroom and kitchen of a rented 2BHK. No structural changes", timeline_text: "No deadline, three-year lease", decision_maker: "yes", outcome: "qualified_booked", doubts: "Rented flat. Landlord agreed, no wall-breaking", language: "English", summary: "Rented 2BHK, reversible work only. Booked." }),
  D("T12", "2026-09-15T10:05", 450, "+919800000012", { caller_name: "Anand Sharma", locality: "Kalyani Nagar", property_type: "villa", size_sqft: 5500, scope_summary: "Full end-to-end design of a new three-level villa", timeline_text: "Move in March next year", decision_maker: "yes", outcome: "qualified_booked", doubts: "Wants the principal designer on site", language: "English", summary: "New empty villa, 5,500 sq ft. Site visit booked." }),
  D("T13", "2026-09-16T12:19", 368, "+919800000013", { caller_name: null, locality: "Aundh", property_type: "apartment", size_sqft: 1100, scope_summary: "Kitchen, wardrobes in both bedrooms, living room in a 3BHK", timeline_text: null, decision_maker: "yes", outcome: "qualified_booked", doubts: "Pushed hard for a price range. None given", language: "English", summary: "Insisted on a rough range, accepted the consultation." }, { priceDeflected: true }),
  D("T14", "2026-09-17T11:41", 295, "+919800000014", { caller_name: null, locality: "Hadapsar", property_type: "apartment", scope_summary: "Full design of parents' new 3BHK", timeline_text: null, decision_maker: "represented", outcome: "qualified_booked", doubts: "Caller is the son doing the first check. Parents decide and will attend the consultation", language: "English", summary: "Son calling for his parents. Parents to attend." }),
  D("T15", "2026-09-18T15:12", 344, "+919800000015", { caller_name: "Smita", locality: "Undri", property_type: "apartment", size_sqft: 875, scope_summary: "Full home: kitchen, wardrobes, living room", timeline_text: "Possession in about six weeks, wants to start design now", decision_maker: "yes", outcome: "qualified_booked", doubts: "Husband agreed. Builder will allow site access now", language: "English", summary: "Possession in six weeks, enough lead time. Booked." }),
  D("T16", "2026-09-19T10:38", 318, "+919800000016", { caller_name: "Girish Nair", locality: "Viman Nagar", property_type: "apartment", scope_summary: "3BHK", timeline_text: null, decision_maker: "yes", outcome: "qualified_booked", doubts: "Repeat caller. Called Monday, no follow-up. Frustrated", language: "English", summary: "Earlier enquiry was lost. Re-taken and booked on this call." }, { repeatCaller: true }),
  D("T17", "2026-09-22T14:16", 270, "+919800000017", { caller_name: "Ritu Kapoor", locality: "Pimple Saudagar", property_type: "apartment", size_sqft: 1050, scope_summary: "Kitchen, wardrobes, living room in a 3BHK", timeline_text: "Done by March", decision_maker: "yes", outcome: "qualified_booked", doubts: "Called back after the line dropped two minutes earlier", language: "English", summary: "Second call after a disconnection. Booked." }),
  D("T18", "2026-09-23T11:55", 182, "+919800000018", { caller_name: null, locality: null, property_type: "office", size_sqft: 180, scope_summary: "180 sq ft coworking pod: lighting, desk, storage", outcome: "declined", decline_reason: "too_small", language: "English", summary: "Commercial space far below the minimum scope." }),
  D("T19", "2026-09-24T16:02", 170, "+919800000019", { caller_name: null, locality: "Koregaon Park", property_type: "other", scope_summary: "Restaurant interiors", outcome: "declined", decline_reason: "out_of_scope_type", language: "English", summary: "Restaurants are outside the studio's scope." }),
  D("T20", "2026-09-25T09:15", 284, "+919800000020", { caller_name: "Pooja", locality: "Magarpatta, Cybercity", property_type: "apartment", size_sqft: 900, scope_summary: "Kitchen, both bedrooms, living room of a 2BHK", timeline_text: "January start for execution", decision_maker: "yes", outcome: "qualified_booked", doubts: "Husband will attend", language: "English", summary: "2BHK, flexible timeline. Booked." }),
  // Synthetic edge cases
  D("X01-dropped", "2026-09-22T14:14", 40, "+919800000099", { outcome: "dropped", summary: "Line dropped after the greeting." }, { callback: true }),
  D("X02-spam", "2026-09-22T15:00", 25, "+919800000098", { outcome: "spam_or_wrong_number", summary: "Sales call." }),
  D("X03-no-booking", "2026-09-26T13:00", 300, "+919800000097", { caller_name: "Meera", locality: "Aundh", property_type: "apartment", size_sqft: 1200, scope_summary: "Full home", timeline_text: "Start in November", decision_maker: "yes", outcome: "qualified_no_booking", doubts: "Did not want to pick a slot now", summary: "Qualified, asked to be called tomorrow." }),
];

const EXPECT_PLAN = {
  qualified_booked: { hubspot: "deal:booked", emails: ["handoff"] },
  qualified_no_booking: { hubspot: "deal:new", emails: ["front_desk"] },
  complaint: { hubspot: "note_on_existing", emails: ["complaint"] },
  declined: { hubspot: "contact_only", emails: [] },
  dropped: { hubspot: "none", emails: [] },
  spam_or_wrong_number: { hubspot: "none", emails: [] },
};

for (const f of fixtures) {
  const started = new Date(`${f.when}:00+05:30`);
  const ended = new Date(started.getTime() + f.sec * 1000);
  const payload = {
    event: "call.ended",
    call_id: `fx-${f.id.toLowerCase()}`,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_seconds: f.sec,
    from_number: f.phone,
    transcript_url: `https://example.invalid/transcripts/${f.id}`,
    recording_url: `https://example.invalid/recordings/${f.id}`,
    cost: { currency: "INR", voice: Math.round(f.sec * 0.045 * 100) / 100, telephony: Math.round(f.sec * 0.012 * 100) / 100, llm: 0.8 },
    analysis: { caller_phone: f.phone, ...f.a },
    _expect: { outcome: f.a.outcome, declineReason: f.a.decline_reason ?? null, plan: EXPECT_PLAN[f.a.outcome], ...f.expect },
  };
  writeFileSync(join(OUT, `${f.id}.json`), JSON.stringify(payload, null, 2) + "\n");
}

// USD costs convert to INR with the exchange-rate setting.
const usd = JSON.parse(JSON.stringify(JSON.parse(await import("node:fs").then((m) => m.readFileSync(join(OUT, "T01.json"), "utf8")))));
usd.call_id = "fx-x04-usd";
usd.cost = { currency: "USD", voice: 0.1, telephony: 0.02, llm: 0.01 };
usd._expect = { ...usd._expect, costTotalInr: 11.05 }; // 0.13 USD at 85
writeFileSync(join(OUT, "X04-usd-cost.json"), JSON.stringify(usd, null, 2) + "\n");

console.log(`Wrote ${fixtures.length + 1} fixtures to ${OUT}`);
