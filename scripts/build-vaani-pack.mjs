// Builds ./vaani-pack: everything to paste or upload into the Vaani dashboard, from the files in /agent.
// Run: npm run vaani:pack
//
// - The system prompt and knowledge files are copied from /agent with our internal "TODO for Nikhil" notes removed,
//   because the voice agent must only ever see facts and rules, never our to-do list.
// - The webhook file contains the secret, so the whole folder is git-ignored.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataPoints, systemPrompt } from "./lib/vaani-agent.mjs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "vaani-pack");
const SITE = process.env.APP_URL ?? "https://aangan-studio-sigma.vercel.app";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "2-knowledge-files"), { recursive: true });

const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
// Drop "TODO for Nikhil: ..." (to the end of its line) and tidy the space it leaves behind.
const stripTodos = (t) =>
  t
    .split("\n")
    .map((l) => l.replace(/\s*TODO for Nikhil:.*$/, ""))
    .filter((l) => !/^\s*TODO for Nikhil/.test(l))
    .join("\n");

// 1. System prompt: the rules plus the studio facts, in one paste. No knowledge-base step is needed for the agent to know them.
const body = systemPrompt();
writeFileSync(join(OUT, "1-system-prompt.txt"), body + "\n");

// 2. Knowledge files
const kdir = join(ROOT, "agent", "knowledge");
const knowledge = [];
for (const f of readdirSync(kdir).filter((f) => f.endsWith(".md")).sort()) {
  const clean = stripTodos(read(`agent/knowledge/${f}`)).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  writeFileSync(join(OUT, "2-knowledge-files", f.replace(/\.md$/, ".txt")), clean);
  knowledge.push(f);
}

// 3. Entity extraction fields (Vaani: Agent Config > Analysis > Entity extraction)
const fields = `ENTITY EXTRACTION FIELDS
In Vaani: Agent Config > your agent > Analysis tab > Entity extraction. Add each field below.
Use the EXACT field name (left). Paste the instruction (right) as that field's extraction prompt.
The app reads the results by these names, so a different spelling means that field is lost.

caller_name
  The caller's full name as they gave it. Null if not given.

caller_phone
  The caller's mobile number as confirmed aloud on the call, with country code, for example +919812345678. Null if not given.

locality
  The Pune or PCMC area where the site is, for example Kothrud or Pimple Saudagar.

property_type
  Exactly one of: apartment, house, villa, office, clinic, other.

size_sqft
  The carpet area in square feet, as a plain number with no units. Null if the caller does not know.

scope_summary
  What they want done, in one or two short lines, for example "Kitchen, wardrobes and living room of a 3BHK".

timeline_text
  When they want the work finished or started, in the caller's own words.

decision_maker
  Exactly one of: yes (the caller decides), represented (the caller is calling for someone who decides), unclear.

budget_mentioned
  Only if the caller said a budget figure themselves, copy it as they said it. The agent never asks. Null otherwise.

outcome
  Exactly one of:
    qualified_booked        a consultation was actually booked in Cal.com during the call
    qualified_no_booking    a good lead, but no booking was made
    declined                the studio politely declined (not a fit)
    complaint               an existing client with a problem (never a lead)
    dropped                 the call ended before enough was collected
    spam_or_wrong_number    a sales call or wrong number

decline_reason
  Only when outcome is declined. Exactly one of: advice_only, out_of_area, timeline, budget, out_of_scope_type, too_small, other. Null otherwise.

doubts
  Anything the designer should check: the decision-maker is unclear, a repeat caller, an area not on the confirmed list, a rented flat. For a complaint, include the designer's name written like "designer Aryan".

language
  The main language of the call: English, Hindi or Marathi.

summary
  A summary in three sentences at most.

RULES (put these in the extraction instructions, or the dispositions section)
- outcome is "qualified_booked" only if a booking was really created during the call.
- An existing client with a problem is always "complaint", never a lead.
- A call that ends before enough was collected is "dropped".
- Never invent a value. Use null when it was not said.
`;
writeFileSync(join(OUT, "3-entity-extraction-fields.txt"), fields);

// 4. Webhook (contains the secret in the address)
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.vercel"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const secret = env.VAANI_WEBHOOK_SECRET;
if (!secret) throw new Error("VAANI_WEBHOOK_SECRET is not in .env.vercel");
writeFileSync(
  join(OUT, "4-webhook-SECRET.txt"),
  `WEBHOOK ADDRESS  (keep this file private: the address contains a secret)

In Vaani: Settings > Webhooks > add this URL. Select all events if it asks.
The app only acts on the final event (call_postprocessing) and quietly ignores the rest.

${SITE}/api/webhooks/vaani?token=${secret}

Vaani does not document webhook signatures or custom headers, so the secret travels in the address itself.
Anyone who knows this full address can send calls to your system, so do not share it or paste it in chat.
`,
);

// 5. Setup guide, following Vaani's own screens (docs.vaanivoice.ai)
writeFileSync(
  join(OUT, "0-START-HERE.txt"),
  `VAANI SETUP: paste pack for Aangan Studio  (app.vaanivoice.ai)

Do these in order. Each file in this folder is one paste or one upload.

FASTEST ROUTE: one command
   In the project folder run:   npm run vaani:sync -- --apply
   It puts the system prompt (rules plus studio facts) and all 14 extraction fields into your agent in Vaani, then
   reads them back to prove they saved. Run it without --apply first to see what it will do. After that you only
   need the Cal.com integration, the webhook, the phone number and the test call (steps 4, 7, 8 and 10 below).
   (5-agent-import.json is NOT recommended: Vaani's import ignored its contents when tried.)

1. CREATE THE AGENT
   Design > Agents > "+ New Agent" > "Build from Scratch". Name it "Aangan Studio front desk".
   Pick a voice in Voice Lab that suits Indian English. If there is a language option, choose English with Hindi and Marathi.

2. SYSTEM PROMPT
   Agent Config > your agent > Persona > Identity > "System Prompt".
   Open 1-system-prompt.txt, Ctrl+A, Ctrl+C, paste.

3. KNOWLEDGE BASE
   Left menu: Knowledge Base > create one named "Aangan Studio" > upload the ${knowledge.length} files in 2-knowledge-files.
   Then attach that knowledge base to the agent. Upload nothing else: never a pricing guide, transcripts or internal notes.

4. CAL.COM BOOKING
   Left menu: Integrations > Cal.com. Vaani asks for a Cal.com API key. Create it in Cal.com
   (Settings > Developer > API keys) and paste it into Vaani yourself. Then choose the event type "Consultation".

5. COMPLAINT TRANSFER
   Left menu: Tools & Actions. Look for a human transfer / call transfer action and set it to Nikhil's number.
   If Vaani does not offer one, tell Claude. The prompt already promises a callback within 15 minutes if a transfer fails.

6. ENTITY EXTRACTION
   Agent Config > your agent > Analysis tab > Entity extraction.
   Open 3-entity-extraction-fields.txt and add each field with the exact name and instruction.

7. WEBHOOK
   Settings > Webhooks. Open 4-webhook-SECRET.txt and add the address in it.

8. PHONE NUMBER
   Agent Config > your agent > Deployment tab > "Inbound Number". Choose the studio number. Save Changes.

9. VAANI API KEY (so the app can read the caller's number and the cost)
   Create an API key in Vaani (docs: Getting Started > Generate an API Key). Add it in Vercel as VAANI_API_KEY.
   Ask Vaani support what one credit costs in rupees, then add VAANI_CREDIT_TO_INR in Vercel (default 1).

10. TEST
   Call the number and ask for a consultation. Then tell Claude "test call done".
   The 20 scenarios and the pricing-pressure calls are in tests/agent-test-log.md.
`,
);

// 6. One-file import (Vaani: Design > Agents > New Agent > Import from JSON).
// Built from Vaani's documented agent structure (docs.vaanivoice.ai/api-reference/create-agent and update-analysis).
// Data point names are limited to 30 characters. It creates a NEW agent with the prompt and all 14 fields ready.
const agentJson = {
  agent_display_name: "Aangan Studio front desk (imported)",
  config: {
    persona: { identity: { system_prompt: body } },
    analysis: {
      extraction: { data_collection: { enabled: true, data_points: dataPoints }, collect_concerns: { enabled: false } },
    },
  },
};
writeFileSync(join(OUT, "5-agent-import.json"), JSON.stringify(agentJson, null, 2) + "\n");

console.log(`Built ${OUT}`);
console.log(`  system prompt: ${body.length} characters`);
console.log(`  knowledge files: ${knowledge.length}`);
