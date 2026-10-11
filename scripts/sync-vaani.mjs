// Pushes the agent's system prompt (rules plus studio facts) and its 14 extraction fields from GitHub into Vaani,
// then reads them back to prove they saved.
//
//   npm run vaani:sync                 shows what WOULD change. Changes nothing.
//   npm run vaani:sync -- --apply      does it.
//   add  --agent "Exact agent name"    to pick another agent (default: "Aangan Studio front desk")
//
// You run this yourself, with your own VAANI_API_KEY (in .env.local). It only ever touches ONE agent, found by its
// exact name, and never deletes anything. Re-run it whenever the files in /agent change.
import { analysisBody, personaBody, systemPrompt, verify } from "./lib/vaani-agent.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: fall back to the real environment
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const nameFlag = args.indexOf("--agent");
const AGENT_NAME = nameFlag >= 0 ? args[nameFlag + 1] : "Aangan Studio front desk";
const BASE = "https://api.vaanivoice.ai/api";
const key = process.env.VAANI_API_KEY;
if (!key) {
  console.error("VAANI_API_KEY is not set. Put it in .env.local first.");
  process.exit(1);
}
const H = { "X-API-Key": key, "Content-Type": "application/json" };

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200).replace(key, "[hidden]")}`);
  return json;
}

const agents = await call("GET", "/agents");
const matches = agents.filter((a) => a.display_name === AGENT_NAME);
if (matches.length !== 1) {
  console.error(`Expected exactly one agent named "${AGENT_NAME}", found ${matches.length}.`);
  console.error("Agents in your workspace:", agents.map((a) => `"${a.display_name}"`).join(", "));
  process.exit(1);
}
const agent = matches[0];
const prompt = systemPrompt();
console.log(`Agent: "${agent.display_name}"`);
console.log(`Will set:  system prompt = ${prompt.length} characters (rules + studio facts), greeting, and 14 extraction fields`);

if (!apply) {
  console.log("\nDry run. Nothing was changed. Run again with  -- --apply  to do it.");
  process.exit(0);
}

await call("PATCH", `/agent/${agent.id}/persona`, personaBody());
await call("PATCH", `/agent/${agent.id}/analysis`, analysisBody());

// Read it back from Vaani and check, never assume.
const stored = await call("GET", `/agent/${agent.id}`);
const checks = verify(stored, prompt.length);
let ok = true;
for (const [label, pass, detail] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!pass) ok = false;
}
console.log(ok ? "\nSaved and verified in Vaani." : "\nSomething did not save. Send this output to Claude.");
process.exit(ok ? 0 : 1);
