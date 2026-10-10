# Vaani tools and call settings

Claude Code cannot click through the Vaani dashboard. Set these up by hand, then tick them off in `tests/agent-test-log.md`.

## 1. Cal.com booking tool
- Event type: **Consultation** on a **round-robin team** event across the active designers, so Cal.com picks the designer.
- Two locations on the event: "Site visit" (the caller gives the address on the call) and "Studio visit".
- Duration: set in Cal.com (confirm with Nikhil).
- Bookable hours: 10am to 7pm IST, on the studio's working days.
- In Vaani: add the Cal.com integration, then give the agent two actions:
  - **Check availability**: returns open slots for the next 14 days.
  - **Create booking**: needs name, phone, email (optional), location type, and the slot.
- Pass the caller's name, phone and locality into the booking notes so the Cal.com webhook can match the booking to the call.
- The agent offers two or three slots only, and confirms the day, date and time in IST aloud.

## 2. Transfer tool (complaints)
- Transfer to Nikhil's number (stored in Vaani, not in this repo).
- Fallback when he does not answer (open question 4 in the build spec: who else?): the agent promises a callback from a senior person within 15 minutes and sets `outcome = complaint`.
- A complaint email is always sent to Nikhil by the webhook, even when the live transfer works.

## 3. Webhook
- Event: end of call. Method: POST. URL: `https://<your-vercel-domain>/api/webhooks/vaani`.
- Add the shared secret in Vaani's webhook settings. It must match `VAANI_WEBHOOK_SECRET`.
- Include in the payload: call ID, start and end time, caller number, transcript, recording URL, cost fields, and the post-call analysis fields from `post-call-fields.md`.

## 4. Agent settings
- Languages: English, Hindi, Marathi, with automatic switching.
- Answers 24 hours a day, every day.
- Knowledge base: upload the four files in `knowledge/` only. Never upload pricing documents, transcripts or internal notes.
- System prompt: paste `system-prompt.md`.
- Recording and transcript: on. The call opens with the standard recording notice if the law or Vaani's defaults require it.
