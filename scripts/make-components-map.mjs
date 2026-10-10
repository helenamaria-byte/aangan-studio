// Draws the components map as a swimlane grid: docs/components-map.svg, and docs/components-map.png if a PNG
// renderer is available. Columns: Actor, Trigger, Input, Context, Processing, AI, Output. One row per actor.
// Run: node scripts/make-components-map.mjs [path-to-@resvg/resvg-js]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const NAVY = "#14284B";

const COLS = ["Trigger", "Input", "Context", "Processing", "AI", "Output"];
const ACTOR_W = 190;
const COL_W = 255;
const X0 = 30;
const TITLE_H = 80;
const HEAD_H = 60;
const ROW_H = 122;
const BOX_W = 227;
const BOX_H = 98;

// Rows: label, sublabel, background tint, box fill, box border
const ROWS = [
  ["Caller", "(User)", "#E8F0FE", "#DCE9FF", "#4A86E8"],
  ["Voice Agent", "(Vaani.ai)", "#F0EAFB", "#E6DBFA", "#7B52D6"],
  ["Calendar", "(Cal.com)", "#E4F6F3", "#CFEFE9", "#1FA58E"],
  ["System", "(App on Vercel)", "#FFF8DF", "#FFF0C2", "#E0A100"],
  ["Data and CRM", "(Neon, HubSpot)", "#E8F6EA", "#D3EFD8", "#2E9E4F"],
  ["Email Service", "(Resend)", "#FDEBF1", "#FADBE7", "#D6457F"],
  ["Staff", "(Designer, Nikhil, Front desk)", "#FFF0E5", "#FFE0CC", "#E8630A"],
];

const W = X0 * 2 + ACTOR_W + COLS.length * COL_W;
const H = TITLE_H + HEAD_H + ROWS.length * ROW_H + 70;

const colX = (c) => X0 + ACTOR_W + c * COL_W;
const rowY = (r) => TITLE_H + HEAD_H + r * ROW_H;
const bx = (c) => colX(c) + (COL_W - BOX_W) / 2;
const by = (r) => rowY(r) + (ROW_H - BOX_H) / 2;
const cy = (r) => by(r) + BOX_H / 2;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const out = [];

out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
out.push(`<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${NAVY}"/></marker></defs>`);
out.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`);
out.push(`<text x="${W / 2}" y="52" font-size="34" font-weight="700" fill="${NAVY}" text-anchor="middle">Aangan Studio · AI Phone Enquiry System — Components Map</text>`);

// Header row
out.push(`<rect x="${X0}" y="${TITLE_H}" width="${W - 2 * X0}" height="${HEAD_H}" rx="10" fill="${NAVY}"/>`);
out.push(`<text x="${X0 + ACTOR_W / 2}" y="${TITLE_H + 38}" font-size="21" font-weight="600" fill="#FFFFFF" text-anchor="middle">Actor</text>`);
COLS.forEach((c, i) => out.push(`<text x="${colX(i) + COL_W / 2}" y="${TITLE_H + 38}" font-size="21" font-weight="600" fill="#FFFFFF" text-anchor="middle">${c}</text>`));

// Rows
ROWS.forEach(([label, sub, tint], r) => {
  out.push(`<rect x="${X0 + ACTOR_W}" y="${rowY(r)}" width="${W - 2 * X0 - ACTOR_W}" height="${ROW_H}" fill="${tint}"/>`);
  out.push(`<rect x="${X0}" y="${rowY(r)}" width="${ACTOR_W}" height="${ROW_H}" fill="${NAVY}"/>`);
  out.push(`<line x1="${X0}" y1="${rowY(r)}" x2="${W - X0}" y2="${rowY(r)}" stroke="#FFFFFF" stroke-width="2"/>`);
  out.push(`<text x="${X0 + ACTOR_W / 2}" y="${rowY(r) + ROW_H / 2 - 4}" font-size="21" font-weight="700" fill="#FFFFFF" text-anchor="middle">${esc(label)}</text>`);
  // sub-label may need two lines
  const words = sub.replace(/[()]/g, "").split(", ");
  const subLines = sub.length > 18 ? [`(${words.slice(0, 2).join(", ")},`, `${words[2]})`] : [sub];
  subLines.forEach((l, i) => out.push(`<text x="${X0 + ACTOR_W / 2}" y="${rowY(r) + ROW_H / 2 + 20 + i * 18}" font-size="14.5" fill="#D6DEEC" text-anchor="middle">${esc(l)}</text>`));
});
// vertical column guides
COLS.forEach((_, i) => out.push(`<line x1="${colX(i)}" y1="${TITLE_H + HEAD_H}" x2="${colX(i)}" y2="${TITLE_H + HEAD_H + ROWS.length * ROW_H}" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="1.5"/>`));

// Boxes: [row, col, lines[]]
const BOXES = {
  B1: [0, 0, ["Caller phones the studio", "number, any hour"]],
  B2: [0, 1, ["Caller's spoken details:", "name, area, size, scope,", "timeline"]],
  B3: [1, 2, ["Prompt and knowledge files", "from GitHub (services, area,", "process). No prices."]],
  B4: [1, 4, ["Qualifies with 5 checks.", "English, Hindi, Marathi.", "Never states a price."]],
  B5: [2, 3, ["Books the consultation.", "Round-robin picks the", "designer."]],
  B6: [3, 0, ["Vaani end-of-call event", "arrives (secret in the", "web address)"]],
  B7: [3, 1, ["Transcript and extracted", "fields: name, area,", "outcome..."]],
  B8: [3, 2, ["Caller's number and cost", "from Vaani; booking", "matched by phone"]],
  B9: [3, 3, ["Routes by outcome.", "Retries 3 times, flags", "any failure."]],
  B11: [3, 5, ["Dashboard (sign-in): Home,", "Calls, Reports, Settings.", "Weekly summary email."]],
  B12: [4, 3, ["Neon saves the raw", "payload, outcome", "and cost."]],
  B13: [4, 5, ["HubSpot: contact, deal", "and note. No duplicate", "contacts."]],
  B14: [5, 5, ["Resend sends handoff", "note, alerts, summary,", "sign-in links."]],
  B15: [6, 5, ["Designer: handoff note.", "Nikhil: urgent alerts.", "Front desk: leads."]],
};
const FINAL = new Set(["B11", "B15"]);

// Arrows first (so boxes sit on top)
const dash = (d) => out.push(`<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#a)"/>`);
const right = (id) => bx(BOXES[id][1]) + BOX_W;
const left = (id) => bx(BOXES[id][1]);
const top = (id) => by(BOXES[id][0]);
const bottom = (id) => by(BOXES[id][0]) + BOX_H;
const midX = (id) => bx(BOXES[id][1]) + BOX_W / 2;
const midY = (id) => cy(BOXES[id][0]);
const gutterAfter = (id) => colX(BOXES[id][1] + 1);

dash(`M${right("B1")},${midY("B1")} H${left("B2")}`);
dash(`M${right("B2")},${midY("B2")} H${gutterAfter("B2")} V${midY("B3")} H${left("B3")}`);
dash(`M${right("B3")},${midY("B3")} H${left("B4")}`);
dash(`M${midX("B4")},${bottom("B4")} V${rowY(2)} H${midX("B5")} V${top("B5")}`);
dash(`M${midX("B5")},${bottom("B5")} V${rowY(3)} H${midX("B6")} V${top("B6")}`);
dash(`M${right("B6")},${midY("B6")} H${left("B7")}`);
dash(`M${right("B7")},${midY("B7")} H${left("B8")}`);
dash(`M${right("B8")},${midY("B8")} H${left("B9")}`);
dash(`M${right("B9")},${midY("B9")} H${left("B11")}`);
dash(`M${midX("B9")},${bottom("B9")} V${top("B12")}`);
dash(`M${right("B12")},${midY("B12")} H${left("B13")}`);
dash(`M${midX("B13")},${bottom("B13")} V${top("B14")}`);
dash(`M${midX("B14")},${bottom("B14")} V${top("B15")}`);

for (const [id, [r, c, lines]] of Object.entries(BOXES)) {
  const [, , , fill, stroke] = ROWS[r];
  const f = FINAL.has(id) ? "#FFFFFF" : fill;
  const s = FINAL.has(id) ? "#E5483A" : stroke;
  out.push(`<rect x="${bx(c)}" y="${by(r)}" width="${BOX_W}" height="${BOX_H}" rx="12" fill="${f}" stroke="${s}" stroke-width="2.6"/>`);
  const startY = by(r) + BOX_H / 2 - ((lines.length - 1) * 19) / 2 + 5;
  lines.forEach((l, i) => out.push(`<text x="${bx(c) + BOX_W / 2}" y="${startY + i * 19}" font-size="15.5" fill="${NAVY}" text-anchor="middle">${esc(l)}</text>`));
}

out.push(`<text x="${X0}" y="${H - 28}" font-size="16" fill="#5B6578">Dashed arrows follow one call from the phone ring to the people who act on it. Red boxes are what the studio sees.</text>`);
out.push(`</svg>`);
const svg = out.join("\n");

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs", "components-map.svg"), svg);
console.log("wrote docs/components-map.svg");

const resvgPath = process.argv[2];
if (resvgPath) {
  const { Resvg } = createRequire(import.meta.url)(resvgPath);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: Math.round(W * 1.5) }, font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng();
  writeFileSync(join(ROOT, "docs", "components-map.png"), png);
  console.log(`wrote docs/components-map.png (${Math.round(png.length / 1024)} KB)`);
}
