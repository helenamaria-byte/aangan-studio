// Everything we want the Vaani agent to contain, built from the files in /agent (the source of truth in GitHub).
// Used by `npm run vaani:pack` (paste files) and `npm run vaani:sync` (pushes them to Vaani for you).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

// Our internal "TODO for Nikhil" notes must never reach the voice agent.
export const stripTodos = (t) =>
  t
    .split("\n")
    .filter((l) => !/^\s*TODO for Nikhil/.test(l)) // a line that is only a note goes entirely
    .map((l) => l.replace(/\s*TODO for Nikhil:.*$/, "")) // a note at the end of a line goes, the rest stays
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** The rules for the agent: agent/system-prompt.md without its "paste this into Vaani" header. */
export function promptRules() {
  const prompt = read("agent/system-prompt.md");
  return prompt.slice(prompt.indexOf("\n---\n") + 5).trim();
}

/** The four knowledge files (facts only), cleaned. */
export function knowledgeFiles() {
  const dir = join(ROOT, "agent", "knowledge");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ file: f, text: stripTodos(read(`agent/knowledge/${f}`)) + "\n" }));
}

/**
 * The full system prompt: the rules, then the studio facts. The facts go in the prompt itself, so the agent always
 * has them. A separate knowledge base is optional extra.
 */
export function systemPrompt({ withFacts = true } = {}) {
  const rules = promptRules();
  if (!withFacts) return rules;
  const facts = knowledgeFiles()
    .map((k) => k.text.replace(/^# /m, "## ").replace(/^## (?!#)/gm, "### "))
    .join("\n\n");
  return `${rules}\n\n---\n\n# Studio facts (for reference during calls)\n\nUse these facts to answer questions. They contain no prices, and you must never state one.\n\n${facts}`.trim();
}

export const GREETING = "Hello, Aangan Studio. How can I help you today?";

const OUTCOMES = ["qualified_booked", "qualified_no_booking", "declined", "complaint", "dropped", "spam_or_wrong_number"];

/** The 14 fields the app reads after every call. Names are limited to 30 characters by Vaani. */
export const dataPoints = [
  { name: "caller_name", prompt: "The caller's full name as they gave it. Null if not given.", nullable: true },
  { name: "caller_phone", prompt: "The caller's mobile number as confirmed aloud, with country code, for example +919812345678. Null if not given.", nullable: true },
  { name: "locality", prompt: "The Pune or PCMC area where the site is, for example Kothrud or Pimple Saudagar.", nullable: true },
  { name: "property_type", prompt: "The type of property.", values: ["apartment", "house", "villa", "office", "clinic", "other"], nullable: true },
  { name: "size_sqft", prompt: "The carpet area in square feet, as a plain number with no units. Null if the caller does not know.", nullable: true },
  { name: "scope_summary", prompt: "What they want done, in one or two short lines, for example 'Kitchen, wardrobes and living room of a 3BHK'.", nullable: true },
  { name: "timeline_text", prompt: "When they want the work finished or started, in the caller's own words.", nullable: true },
  { name: "decision_maker", prompt: "yes if the caller decides; represented if the caller is calling for someone who decides; unclear otherwise.", values: ["yes", "represented", "unclear"], nullable: true },
  { name: "budget_mentioned", prompt: "Only if the caller said a budget figure themselves, copy it as they said it. The agent never asks. Null otherwise.", nullable: true },
  {
    name: "outcome",
    prompt:
      "qualified_booked: a consultation was actually booked in Cal.com during the call. qualified_no_booking: a good lead but no booking was made. declined: the studio politely declined (not a fit). complaint: an existing client with a problem (never a lead). dropped: the call ended before enough was collected. spam_or_wrong_number: a sales call or wrong number. Use qualified_booked only if a booking was really created.",
    values: OUTCOMES,
    nullable: false,
  },
  { name: "decline_reason", prompt: "Only when outcome is declined. Null otherwise.", values: ["advice_only", "out_of_area", "timeline", "budget", "out_of_scope_type", "too_small", "other"], nullable: true },
  { name: "doubts", prompt: "Anything the designer should check: unclear decision-maker, a repeat caller, an area not on the confirmed list, a rented flat. For a complaint, include the designer's name written like 'designer Aryan'.", nullable: true },
  { name: "language", prompt: "The main language of the call.", values: ["English", "Hindi", "Marathi", "Other"], nullable: true },
  { name: "summary", prompt: "A summary of the call in three sentences at most.", nullable: true },
];

// ---- the two requests, as Vaani documents them (docs.vaanivoice.ai/api-reference) ----

export const personaBody = (opts) => ({
  identity: { system_prompt: systemPrompt(opts), greeting_message: { agent_message: GREETING, let_user_speak_first: false } },
});

export const analysisBody = () => ({
  extraction: { data_collection: { enabled: true, data_points: dataPoints } },
});

/** What to compare against after saving. Pure, so it can be tested. */
export function verify(stored, expectedPromptLength) {
  const checks = [];
  const prompt = stored?.persona?.identity?.system_prompt ?? "";
  checks.push(["system prompt saved", prompt.length === expectedPromptLength, `${prompt.length} of ${expectedPromptLength} characters`]);
  checks.push(["prompt contains the pricing rule", /pricing depends on the site, the materials you choose, and the scope/i.test(prompt), ""]);
  const dc = stored?.analysis?.extraction?.data_collection;
  const names = (dc?.data_points ?? []).map((d) => d.name);
  checks.push(["extraction turned on", dc?.enabled === true, ""]);
  const missing = dataPoints.map((d) => d.name).filter((n) => !names.includes(n));
  checks.push(["all 14 extraction fields saved", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${names.length} fields`]);
  return checks;
}
