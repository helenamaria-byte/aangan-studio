// Fails the build if a price figure appears in the agent files.
// Rule 1 of the build spec: the system never states a price, and pricing numbers
// must never reach Vaani. Run with: npm run check:no-prices
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../agent", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const PATTERNS = [
  { name: "rupee sign followed by a number", re: /(₹|\b(Rs\.?|INR)\b)\s*\d/i },
  { name: "number followed by lakh, crore or lac", re: /\d[\d.,]*\s*(lakhs?|lacs?|crores?)\b/i },
  { name: "per sq ft with a number", re: /(\d[\d.,]*\s*(per|\/)\s*(sq\.?\s*ft|square\s*f(oo|ee)t|sqft))|((per|\/)\s*(sq\.?\s*ft|square\s*f(oo|ee)t|sqft)\s*\W{0,3}\s*\d)/i },
  { name: "rate or price followed by a number", re: /\b(rate|rates|price|prices|cost|costs|charge|charges)\b[^.\n]{0,20}\b\d{3,}/i },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let failures = 0;
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        console.error(`${file}:${i + 1}: ${name}\n  ${line.trim()}`);
        failures++;
      }
    }
  });
}

if (failures) {
  console.error(`\n${failures} possible price figure(s) found in /agent. Remove them.`);
  process.exit(1);
}
console.log("No price figures found in /agent.");
