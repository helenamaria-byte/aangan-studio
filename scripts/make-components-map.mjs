// Draws the components map: docs/components-map.svg, and docs/components-map.png if a PNG renderer is available.
// Run: node scripts/make-components-map.mjs [path-to-@resvg/resvg-js]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1800;
const H = 1230;

const INK = "#2B2522";
const MUTED = "#7A716B";
const SAGE = "#4F6B5A";
const LINE = "#D8D2CB";
const BG = "#FAFAF7";
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const out = [];

function box(x, y, w, h, title, lines = [], o = {}) {
  const fill = o.fill ?? "#FFFFFF";
  const stroke = o.stroke ?? LINE;
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw ?? 1.5}"/>`);
  out.push(`<text x="${x + 20}" y="${y + 34}" font-size="21" font-weight="600" fill="${INK}">${esc(title)}</text>`);
  lines.forEach((l, i) => out.push(`<text x="${x + 20}" y="${y + 62 + i * 23}" font-size="15.5" fill="${MUTED}">${esc(l)}</text>`));
}

function arrow(d, o = {}) {
  out.push(`<path d="${d}" fill="none" stroke="${SAGE}" stroke-width="2.4" ${o.start ? 'marker-start="url(#a)"' : ""} marker-end="url(#a)"/>`);
}

function badge(x, y, n) {
  out.push(`<circle cx="${x}" cy="${y}" r="15" fill="${SAGE}"/>`);
  out.push(`<text x="${x}" y="${y + 5.5}" font-size="15" font-weight="700" fill="#FFFFFF" text-anchor="middle">${n}</text>`);
}

out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
out.push(`<defs><marker id="a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${SAGE}"/></marker></defs>`);
out.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

// Title
out.push(`<text x="60" y="72" font-size="36" font-weight="600" fill="${INK}">Aangan Studio: AI phone enquiry system</text>`);
out.push(`<text x="60" y="108" font-size="19" fill="${MUTED}">Components map. Every call is answered, qualified, booked, handed to a designer, and logged. Numbers follow one call from start to finish.</text>`);

// Left column
box(60, 300, 220, 110, "Caller", ["Phones the studio", "number, any hour"]);
box(360, 240, 300, 230, "Vaani.ai voice agent", ["Answers every call, 24/7", "English, Hindi, Marathi", "Five qualifying checks", "Never states a price", "Books on the call", "Transfers complaints"]);
box(360, 620, 300, 150, "Cal.com", ["Consultation booking", "Round-robin picks the", "designer (team plan)"]);
box(360, 860, 300, 130, "GitHub", ["Code, agent prompt and", "knowledge files, tests"]);

// Vercel container
out.push(`<rect x="780" y="180" width="560" height="700" rx="18" fill="#F1F5F2" stroke="${SAGE}" stroke-width="2"/>`);
out.push(`<text x="806" y="216" font-size="23" font-weight="600" fill="${SAGE}">Vercel: Next.js app (Singapore)</text>`);
box(810, 245, 500, 95, "POST /api/webhooks/vaani", ["Checks the secret, ignores all but the final event,", "saves each call once (repeat deliveries are harmless)"]);
box(810, 360, 500, 80, "POST /api/webhooks/calcom", ["Checks the signature, records bookings and cancellations"]);
box(810, 460, 500, 165, "Call pipeline: routes by outcome", ["Booked: HubSpot deal, then designer email", "Lead without booking: front-desk email", "Complaint: urgent email to Nikhil, first", "Declined: HubSpot contact only. Dropped: callback", "Every failure retried 3 times, then flagged"]);
box(810, 645, 500, 105, "Dashboard (email sign-in link)", ["Home, Calls, Reports, Settings", "Owner and front-desk roles"]);
box(810, 765, 500, 90, "Weekly summary: Monday 9am IST", ["Vercel cron emails the owner the week's numbers"]);

// Right column
box(1480, 210, 280, 170, "Neon Postgres", ["calls, bookings,", "designers, settings", "Raw payloads, outcomes,", "costs"]);
box(1480, 420, 280, 140, "HubSpot CRM", ["Contact, deal, notes", "One contact per phone", "number"]);
box(1480, 600, 280, 140, "Resend", ["Handoff note, alerts,", "weekly summary,", "sign-in links"]);
box(1480, 800, 280, 190, "People", ["Designer: complete handoff", "note within minutes", "Nikhil: urgent alerts,", "dashboard, summary", "Front desk: leads to call back"], { fill: "#FFFFFF" });

// Arrows and numbered badges
arrow("M280,355 H360");               badge(320, 355, 1);
arrow("M510,470 V620", { start: true }); badge(510, 545, 2);
arrow("M660,695 H730 V400 H810");     badge(730, 560, 3);
arrow("M660,285 H810");               badge(735, 285, 4);
arrow("M810,335 H660");               badge(735, 335, 5);
arrow("M1340,295 H1480");             badge(1410, 295, 6);
arrow("M1340,490 H1480");             badge(1410, 490, 7);
arrow("M1340,670 H1480");             badge(1410, 670, 8);
arrow("M1620,740 V800");
arrow("M1480,880 H1405 V700 H1310");  badge(1405, 800, 9);
arrow("M660,925 H1060 V880");         badge(900, 925, 10);

// Steps
out.push(`<line x1="60" y1="1030" x2="${W - 60}" y2="1030" stroke="${LINE}" stroke-width="1.5"/>`);
out.push(`<text x="60" y="1068" font-size="21" font-weight="600" fill="${INK}">How one call flows</text>`);
const steps = [
  "The caller dials the studio number. Vaani answers at any hour.",
  "Vaani qualifies the caller and books the consultation in Cal.com during the call.",
  "Cal.com sends the booking to the app as a signed message.",
  "When the call ends, Vaani sends the transcript and extracted fields.",
  "The app reads the caller's number and the cost from Vaani's call history.",
  "The app saves the raw payload, the outcome and the cost in Neon.",
  "The app creates the HubSpot contact, deal and note, with no duplicates.",
  "Resend emails the designer, Nikhil or the front desk, whichever applies.",
  "The owner and front desk sign in and read everything on the dashboard.",
  "Every push to GitHub runs the tests and price check, then deploys to Vercel.",
];
steps.forEach((t, i) => {
  const col = i < 5 ? 0 : 1;
  const row = i % 5;
  const x = 60 + col * 870;
  const y = 1102 + row * 27;
  badge(x + 12, y - 5, i + 1);
  out.push(`<text x="${x + 38}" y="${y}" font-size="16" fill="${INK}">${esc(t)}</text>`);
});

out.push(`</svg>`);
const svg = out.join("\n");

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs", "components-map.svg"), svg);
console.log("wrote docs/components-map.svg");

const resvgPath = process.argv[2];
if (resvgPath) {
  const { Resvg } = createRequire(import.meta.url)(resvgPath);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W * 1.5 }, font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng();
  writeFileSync(join(ROOT, "docs", "components-map.png"), png);
  console.log(`wrote docs/components-map.png (${Math.round(png.length / 1024)} KB)`);
}
