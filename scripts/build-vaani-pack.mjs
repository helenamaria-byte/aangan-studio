// Builds ./vaani-pack: everything to paste or upload into the Vaani dashboard, from the files in /agent.
// Run: npm run vaani:pack
//
// - The system prompt and knowledge files are copied from /agent with our internal "TODO for Nikhil" notes removed,
//   because the voice agent must only ever see facts and rules, never our to-do list.
// - The webhook file contains the secret, so the whole folder is git-ignored.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

// 1. System prompt: the part after the "Paste this into..." header.
const prompt = read("agent/system-prompt.md");
const body = prompt.slice(prompt.indexOf("\n---\n") + 5).trim();
writeFileSync(join(OUT, "1-system-prompt.txt"), body + "\n");

// 2. Knowledge files
const kdir = join(ROOT, "agent", "knowledge");
const knowledge = [];
for (const f of readdirSync(kdir).filter((f) => f.endsWith(".md")).sort()) {
  const clean = stripTodos(read(`agent/knowledge/${f}`)).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  writeFileSync(join(OUT, "2-knowledge-files", f.replace(/\.md$/, ".txt")), clean);
  knowledge.push(f);
}

// 3. Post-call fields, laid out as a table to copy into Vaani's analysis / extraction setup
const fields = `POST-CALL FIELDS
Add each of these as a field in Vaani's post-call analysis (also called "structured extraction" or "call analysis").
Use the exact field names below. The app reads them by these names.

caller_name        text      The caller's name. Null if not given.
caller_phone       text      The caller's phone number, confirmed on the call. Use caller ID if not confirmed.
locality           text      The Pune or PCMC area of the site.
property_type      choice    One of: apartment, house, villa, office, clinic, other
size_sqft          number    Carpet area in square feet. Null if unknown.
scope_summary      text      What they want done, in one or two lines.
timeline_text      text      When they want it done or started, in the caller's own words.
decision_maker     choice    One of: yes, represented, unclear
budget_mentioned   text      ONLY if the caller volunteered a figure. Null otherwise. The agent never asks.
outcome            choice    One of: qualified_booked, qualified_no_booking, declined, complaint, dropped, spam_or_wrong_number
decline_reason     choice    One of: advice_only, out_of_area, timeline, budget, out_of_scope_type, too_small, other. Null unless outcome is declined.
doubts             text      Anything the designer should check: unclear decision-maker, repeat caller, unconfirmed area.
language          text      The main language of the call.
summary            text      Three sentences at most.

RULES TO PUT IN THE ANALYSIS INSTRUCTIONS
- outcome is "qualified_booked" only if a booking was actually created in Cal.com during the call.
- An existing client with a problem is always "complaint", never a lead.
- A call that ends before enough was collected is "dropped".
- Never invent a value. Use null when it was not said.
- In summary or doubts for a complaint, include the designer's name if the caller gave it, written like: "designer Aryan".
`;
writeFileSync(join(OUT, "3-post-call-fields.txt"), fields);

// 4. Webhook (contains the secret)
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.vercel"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const secret = env.VAANI_WEBHOOK_SECRET;
if (!secret) throw new Error("VAANI_WEBHOOK_SECRET is not in .env.vercel");
writeFileSync(
  join(OUT, "4-webhook-SECRET.txt"),
  `END-OF-CALL WEBHOOK  (keep this file private: it contains a secret)

Event:   end of call (call completed / call ended)
Method:  POST
URL:     ${SITE}/api/webhooks/vaani

Authentication. Use whichever your Vaani webhook screen offers:
  A) A custom header
       Header name:   x-vaani-secret
       Header value:  ${secret}
  B) A "signing secret" that Vaani uses to sign the body (HMAC SHA-256, sent in a header such as x-vaani-signature)
       Secret:        ${secret}

The payload should include: call id, start and end time, duration in seconds, caller phone number,
recording URL, transcript (text) and transcript URL, cost (with currency), and the post-call fields from file 3.
`,
);

// 5. Setup guide
writeFileSync(
  join(OUT, "0-START-HERE.txt"),
  `VAANI SETUP: paste pack for Aangan Studio

Do these in order. Each file in this folder is one paste or one upload.

1. Create an agent in Vaani. Name it "Aangan Studio front desk".
   Languages: English, Hindi, Marathi, with automatic switching.
   It must answer 24 hours a day, every day.

2. SYSTEM PROMPT  ->  open 1-system-prompt.txt, Ctrl+A, Ctrl+C, paste into the agent's prompt / instructions field.

3. KNOWLEDGE  ->  upload the ${knowledge.length} files in the folder 2-knowledge-files. Upload nothing else.
   Never upload a pricing guide, transcripts, or any internal document.

4. CAL.COM BOOKING  ->  in Vaani's integrations, connect Cal.com.
   Vaani will ask for a Cal.com API key. Create one in Cal.com: Settings, Developer, API keys. Paste it into Vaani yourself.
   Give the agent two actions: check availability (next 14 days) and create booking.
   Booking needs: caller name, phone, email (optional), location (site visit or studio), and the chosen slot.
   Event to use: "Consultation".

5. COMPLAINT TRANSFER  ->  add a "transfer call" action to Nikhil's phone number.
   If the transfer fails, the agent promises a callback from a senior person within 15 minutes (already in the prompt).

6. POST-CALL ANALYSIS  ->  open 3-post-call-fields.txt and add each field exactly as named.

7. WEBHOOK  ->  open 4-webhook-SECRET.txt and fill in the end-of-call webhook.

8. PHONE NUMBER  ->  attach the studio's number to the agent (or forward the existing studio number to Vaani's number).

9. RECORDING  ->  turn on call recording and transcripts. If Vaani requires a recording notice, enable it.

10. TEST  ->  call the number and say you want a consultation. Then tell Claude "test call done" and the app will be checked.
    The full list of 20 scenarios and pricing-pressure calls is in tests/agent-test-log.md.
`,
);

console.log(`Built ${OUT}`);
console.log(`  system prompt: ${body.length} characters`);
console.log(`  knowledge files: ${knowledge.length}`);
