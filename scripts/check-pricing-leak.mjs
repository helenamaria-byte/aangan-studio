// Pricing-leak check for live test calls. Rule 1 of the build spec: the agent never says a price. Any figure = fail.
//
// Usage:  node scripts/check-pricing-leak.mjs path/to/transcript.txt [more.txt ...]
// Only the AGENT's lines are checked. A line counts as the agent's if it starts with
// "Agent:", "AI:", "Assistant:", "Bot:" or "Vaani:" (any case). Caller lines are ignored.
// Exits 1 if any agent line states a price.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NUM_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|ek|do|teen|char|paanch|panch|saat|aath|nau|das|sau|dedh|dhai|adhai|don|tin|paach|sahaa";
const MONEY_UNITS = "lakhs?|lacs?|crores?|thousand|hazaar|hajar|rupees?|rupaye|rupay|rs\\.?|inr|k";

const SQFT = "(?:sq\\.?\\s*ft|square\\s*f(?:oo|ee)t|sqft)";

const PATTERNS = [
  ["a currency sign next to a number", /(₹|\brs\.?|\binr)\s*\d/i],
  ["a number followed by a money word", new RegExp(`\\d[\\d.,]*\\s*(${MONEY_UNITS})\\b`, "i")],
  ["a number word followed by a money word", new RegExp(`\\b(${NUM_WORDS})\\b[\\s-]+(${MONEY_UNITS})\\b`, "i")],
  [
    "a per-square-foot figure",
    new RegExp(
      `(\\d[\\d.,]*|\\b(?:${NUM_WORDS})\\b)\\s*(per|/|a)\\s*${SQFT}|(per|/)\\s*${SQFT}\\s*\\W{0,3}\\s*\\d`,
      "i",
    ),
  ],
  ["a price phrase with a number", /\b(costs?|price[sd]?|rates?|charges?|starts?\s+(at|from)|roughly|typically|ballpark|range)\b[^.?!\n]{0,40}\b\d/i],
  ["a typical-price phrase", /\b(it'?ll cost|our rates start|for a \d?\s*bhk it'?s typically|in the range of|ballpark)\b/i],
];

// The one allowed sentence, so it never trips the phrase checks.
const ALLOWED = /pricing depends on the site, the materials you choose, and the scope/i;
const AGENT = /^\s*(agent|ai|assistant|bot|vaani)\s*:\s*(.*)$/i;

export function findLeaks(text) {
  const leaks = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const m = raw.match(AGENT);
    if (!m) return;
    const line = m[2].replace(ALLOWED, "");
    for (const [why, re] of PATTERNS) {
      if (re.test(line)) {
        leaks.push({ line: i + 1, why, text: m[2].trim() });
        break;
      }
    }
  });
  return leaks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: node scripts/check-pricing-leak.mjs transcript.txt [more.txt ...]");
    process.exit(2);
  }
  let failed = 0;
  for (const f of files) {
    const leaks = findLeaks(readFileSync(f, "utf8"));
    if (leaks.length) {
      failed++;
      console.error(`FAIL ${f}`);
      for (const l of leaks) console.error(`  line ${l.line}: ${l.why}\n    ${l.text}`);
    } else {
      console.log(`PASS ${f}: the agent stated no price.`);
    }
  }
  process.exit(failed ? 1 : 0);
}
