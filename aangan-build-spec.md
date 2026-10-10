# Aangan Studio: AI Phone Enquiry System
## Build spec and acceptance rubric for Claude Code

Read this whole file before writing code. Build in the phase order given in section 9. A phase is done only when every check in its rubric passes.

---

## 1. What we are building (plain words)

Aangan Studio is an interior design studio in Pune with 14 designers. It gets about 200 enquiries a month. Today, about half get no reply within 48 hours, and a third arrive after office hours (10am–7pm). Leads answered within an hour convert 4 times better than leads answered the next day.

We are building a system that:

1. Answers **every phone call**, day or night, with an AI voice agent (Vaani.ai).
2. Asks the right qualifying questions and **books a consultation on the call** (Cal.com).
3. Sends the assigned designer a **complete handoff email** (Resend), so they never re-ask questions.
4. Records every lead in the CRM (HubSpot).
5. Logs every call and its cost (Neon).
6. Shows the founder, Nikhil, a **simple dashboard** of what the system is doing and what it costs (Next.js on Vercel).

**Scope:** inbound phone calls only. WhatsApp and the web form are out of scope, but the code must be structured so they can be added later as new input sources (see section 10).

**Main user of the dashboard:** Nikhil, the founder. He is not technical. He will often check it on his phone. Second user: the two front-desk staff.

---

## 2. Tech stack (fixed, do not swap)

| Tool | Job |
|---|---|
| **Vaani.ai** | Voice agent: answers calls, qualifies the caller, books via Cal.com, transfers complaints, sends end-of-call data by webhook |
| **Cal.com** | Consultation booking. Use a round-robin team event across designers so Cal.com picks the designer |
| **GitHub** | Code, prompts, and knowledge-base files, all version controlled |
| **Vercel** | Hosts the Next.js app: webhook API routes and the dashboard |
| **Neon** | Postgres database: calls, leads, bookings, costs |
| **HubSpot** | CRM: contacts, deals, notes |
| **Resend** | Emails: designer handoff, complaint alert, weekly summary, login links |

Use Next.js (App Router) with TypeScript, Tailwind CSS, and Drizzle or Prisma for Neon. All secrets go in Vercel environment variables, never in code. Use IST (Asia/Kolkata) for all displayed times.

---

## 3. The non-negotiable rules (apply everywhere)

1. **The system never states a price.** No number, range, or per-sq-ft figure, ever. `pricing.md` (with numbers) must **not** be in the repo's prompt or knowledge folders, and must never be sent to Vaani. The only allowed reply to a pricing question is:
   > "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like."
   This was the founder's original request ("quote standard pricing"). It is deliberately cut, because his own pricing guide says no number should be quoted to a client.
2. **Every call gets a logged outcome.** No call disappears silently.
3. **Complaints from existing clients are not leads.** They are escalated to Nikhil at once.
4. **Do not forward incomplete leads.** A designer email must contain every required field (section 6.3), or clearly mark which ones are unknown.
5. **Store raw data.** Save the full raw webhook payload for every call, so we can reprocess it if parsing changes.

---

## 4. Architecture

```
Caller ──► Studio number ──► Vaani.ai agent ◄──► Cal.com (check slots, book)
                                  │
                       end-of-call webhook
                                  ▼
                   Vercel: /api/webhooks/vaani
                  ┌───────────────┼──────────────────┐
                  ▼               ▼                  ▼
               Neon DB        HubSpot           Resend email
           (call + cost)  (contact, deal)  (designer / Nikhil)
                  │
                  ▼
          Dashboard (Next.js on Vercel)

Cal.com webhook ──► /api/webhooks/calcom ──► Neon (bookings, cancellations)
```

---

## 5. Vaani agent setup

Claude Code cannot click through the Vaani dashboard, but it **must produce the files** that get pasted or uploaded there, stored in the repo:

```
/agent
  system-prompt.md
  knowledge/
    01-services.md
    02-service-area.md
    03-process-and-timelines.md
    04-common-questions.md
  tools.md            (Cal.com booking tool + transfer config, documented)
  post-call-fields.md (structured fields Vaani must extract after each call)
```

### 5.1 System prompt must contain
- Role: friendly front desk for Aangan Studio. Short sentences. Can switch between English, Hindi and Marathi to match the caller.
- The pricing rule and the exact sentence above, plus this "never say" list: any number, "it'll cost around", "our rates start at", "for a 2BHK it's typically".
- Nikhil's five qualification checks:
  1. Real project with execution, not advice only
  2. Site in Pune city or PCMC
  3. Realistic timeline (execution possible within 8–10 weeks of consultation; cannot finish anything in under 6 weeks)
  4. Budget: never ask. Only if the caller volunteers a number that is clearly too low for the scope, gently say so
  5. Decision-maker on the call, or authorised by them
- Boundary rules: unclear on 1, 2 or 3 → ask **one** direct question. Unclear on 4 or 5 → don't push; treat as qualified and note the doubt. Two or more fail → decline politely.
- Things that do **not** disqualify: not knowing what they want, calling after hours, asking about price, a single room with execution, a rented flat with no structural change.
- Fields to collect before booking: name, phone (from caller ID, confirm), locality, property type, size (sq ft carpet), rooms or scope, timeline, decision-maker status.
- Complaint handling: if the caller is an existing client with a problem, apologise, collect name and designer name, and transfer to Nikhil's number. If the transfer fails, promise a callback from a senior person within 15 minutes.
- Booking: offer to book the consultation on the call using the Cal.com tool.

### 5.2 Knowledge base: facts only
Build from `services.md` and the transcripts. Do **not** include `pricing.md`, `qualified.md` rules (those go in the prompt), raw transcripts, or internal names.

### 5.3 Post-call structured fields (from Vaani's post-call analysis)
```
caller_name, caller_phone, locality, property_type (apartment|house|villa|office|clinic|other),
size_sqft, scope_summary, timeline_text, decision_maker (yes|represented|unclear),
budget_mentioned (text or null), outcome (qualified_booked|qualified_no_booking|declined|
complaint|dropped|spam_or_wrong_number), decline_reason (advice_only|out_of_area|timeline|
budget|out_of_scope_type|too_small|other|null), doubts (text), language, summary
```
If Vaani's own extraction is unreliable in testing, add a fallback step in the webhook that calls an LLM API to extract the same fields from the transcript. Make this a config switch: `EXTRACTION_MODE=vaani|llm`.

---

## 6. Backend

### 6.1 `/api/webhooks/vaani` (POST)
1. Verify the webhook signature or secret. Reject if invalid.
2. **Idempotency:** use Vaani's call ID as a unique key. A repeated webhook must not create duplicates.
3. Save the raw payload first, then parse. Vaani's payload shape is not known yet, so write a small adapter `lib/sources/vaani.ts` that maps it to our internal `Enquiry` type. Check Vaani's docs for the real field names.
4. Write the call row to Neon, including cost fields.
5. Route by outcome:
   - `qualified_booked` → HubSpot contact + deal (stage "Consultation booked") + note → Resend handoff email to the designer Cal.com assigned.
   - `qualified_no_booking` → HubSpot contact + deal (stage "New lead") → Resend email to the front desk inbox so a human books it the next morning.
   - `complaint` → Resend urgent email to Nikhil (even if the live transfer worked) → HubSpot note on the existing contact if found.
   - `declined` → HubSpot contact only, tagged with the decline reason. No email.
   - `dropped` → if under 60 seconds and the caller didn't call back within 10 minutes, mark "Needs callback" in the dashboard. If Vaani supports outbound calls, trigger an automatic callback once.
6. Every external call (HubSpot, Resend) is retried up to 3 times. If it still fails, mark the row `needs_attention = true` with the error, so it shows on the dashboard. Never lose the lead.
7. Respond 200 quickly. Do the slow work in a background step if needed.

### 6.2 `/api/webhooks/calcom` (POST)
Record bookings, reschedules, and cancellations in Neon and update the HubSpot deal stage. Match to the call by phone number and time.

### 6.3 Designer handoff email (Resend)
Subject: `New consultation: {name}, {property_type} in {locality}, {date}`

Body, in this order, in plain readable layout:
- Consultation date and time, and whether it's a site visit
- Caller name and phone (tap-to-call link)
- Property: type, size, locality
- What they want: scope summary
- Timeline
- Decision-maker
- Budget mentioned (only if the caller said one)
- Doubts or things to check
- "Already asked on the call. No need to ask again:" with a list of the fields
- Link to the HubSpot deal and the call recording or transcript

Must be readable on a phone. No marketing styling.

### 6.4 Other emails
- **Complaint alert to Nikhil:** subject starts with "Urgent:"; includes name, designer, issue summary, and the phone number.
- **Weekly summary to Nikhil:** Monday 9am IST. The same 4 numbers as the dashboard home (section 7.3), plus anything that needs attention. Use a Vercel cron job.

### 6.5 Neon tables (minimum)
```
calls      id, vaani_call_id (unique), started_at, ended_at, duration_sec, is_after_hours,
           caller_phone, outcome, decline_reason, extracted_fields (jsonb), summary,
           transcript_url, recording_url, raw_payload (jsonb),
           cost_voice_inr, cost_telephony_inr, cost_llm_inr, cost_email_inr, cost_total_inr,
           hubspot_contact_id, hubspot_deal_id, handoff_sent_at, needs_attention, error_text
bookings   id, calcom_booking_id, call_id, designer_id, starts_at, status (booked|rescheduled|cancelled|completed)
designers  id, name, email, active
settings   key, value   (monthly fixed costs, average project value, alert emails, office hours)
```
`is_after_hours` = outside 10:00–19:00 IST or a Sunday (make office hours a setting).

### 6.6 Cost tracking
Per-call costs come from Vaani's webhook (voice + telephony) and from the LLM call if used. Fixed monthly costs (Vercel, Neon, HubSpot, Cal.com, Resend plans) are entered once on the Settings page. Total monthly cost = sum of per-call costs + fixed costs. Show everything in ₹. If Vaani reports costs in USD, convert using an exchange rate stored in settings.

---

## 7. Dashboard: design brief

### 7.1 Principles
- **One question per screen.** The home page answers: "Is the system working, and is it worth it?" Nothing else.
- **Plain words.** Say "Calls answered", not "Inbound volume". Say "Booked consultations", not "Conversions". No technical terms anywhere a user can see.
- **Details on demand.** Any number can be clicked to see what's behind it. Deeper analysis lives on a separate Reports page.
- **Mobile first.** It must work perfectly on a phone in portrait mode. Nikhil will check it between site visits.
- **Indian formats.** ₹ with lakh and crore grouping (₹1,24,500, ₹1.2 lakh), and IST times like "Tue 14 Oct, 10:47 pm".
- **Calm by default.** Use colour only for status (needs attention, success). No decorative charts.
- **Empty and error states give direction.** For example: "No calls yet this week. The agent is live on +91 …" Errors say what failed and what to do.

### 7.2 Visual direction
A studio that designs homes. The interface should feel like a clean, well-lit room: quiet, ordered, plenty of space.
- Background: soft white `#FAFAF7`. Text: deep walnut `#2B2522`. Muted text: `#7A716B`.
- One accent: deep sage `#4F6B5A` for primary actions and positive states. Status amber `#B7791F` for "needs attention" and red `#B42318` only for urgent items.
- One typeface family: a clean humanist sans (e.g. "Inter Tight" or "Figtree"). Two weights only, regular and medium.
- Hierarchy comes from size and spacing, not boxes. Avoid a wall of identical cards with shadows, gradients, all-caps labels, and decorative icons.

### 7.3 Home page (the only page most days)
Top to bottom:

**a) One-sentence summary (the hero).** Plain-language, generated from data, with a period toggle: Today / This week / This month (default: This week).
> "This week the agent answered **54 of 54 calls**, including **19 after hours**, and booked **17 consultations**."

**b) Four numbers, in one row on desktop and a 2×2 grid on mobile.**
| Number | Small line under it |
|---|---|
| Calls answered | "100% answered · 19 after hours" |
| Consultations booked | "+5 vs last week" |
| Est. pipeline value | "17 bookings × avg ₹11 lakh" (the average project value is a setting; labelled as an estimate) |
| Cost this week | "₹X per booked consultation" |

**c) Needs attention.** Shown only if there is something; hidden when empty, replaced by a single "All clear" line. Items include:
- Complaints not marked handled
- Qualified leads with no booking yet
- Dropped calls needing a callback
- Failed emails or CRM syncs

Each row has one clear action button: "Mark handled", "Call back", or "Retry".

**d) Latest calls.** The 8 most recent calls: time, name, locality, and an outcome badge (Booked / Lead / Declined / Complaint / Dropped). There is a "See all calls" link.

That is the whole home page. No charts on the home page.

### 7.4 Click-through pages (deeper details)
- **Call detail** (click any call): summary at top, then the handoff note exactly as emailed, booking info, the designer, cost of this call, and links to the recording, transcript and HubSpot. The full transcript is collapsed by default.
- **All calls:** a searchable list with simple filters: outcome, date, day/after hours. Includes CSV export.
- **Reports** (one page, simple charts, each with a one-line plain-English takeaway above it):
  1. Calls per day, split into office hours and after hours. Takeaway example: "33% of calls came after hours. These would have been missed before."
  2. What happened to calls: answered → qualified → booked → consultation held.
  3. Why callers were declined, as a bar chart.
  4. Before vs after: last month's manual baseline (48% no reply within 48 hours) vs now (time from call to designer email, median).
  5. Cost breakdown by tool per month, and cost per booked consultation over time.
  6. Bookings by designer (to spot uneven load).
- **Settings** (Nikhil and admin only): office hours, designers list, alert email addresses, average project value, fixed monthly tool costs, exchange rate.

### 7.5 Access
Login by email magic link (sent via Resend). Allowed emails are set in settings. Two roles: **Owner** (everything) and **Front desk** (home, calls, needs attention; no costs, no settings).

---

## 8. Test set (must pass before launch)

Use the 20 September phone transcripts (`Aangan_Sep 2026_Enquiries.pdf`, T01–T20). Create `/tests/fixtures/` with a fake Vaani webhook payload per transcript and assert the expected outcome. For the voice agent itself, run each scenario as a live test call and record the result in `/tests/agent-test-log.md`.

| Expected outcome | Transcripts |
|---|---|
| Qualified + booked | T01, T02, T05, T06, T11, T12, T13, T15, T17, T20 |
| Declined (with reason) | T03 out of area, T04 advice only, T10 budget, T18 too small, T19 out of scope type |
| Special | T07 timeline too short → offer later start; T09 complaint → transfer + alert; T14 son for parents → qualified, decision-maker "represented", flagged; T16 repeat caller → link to earlier record; T08 after-hours → answered (no missed call) |

Pricing-leak tests: at least 5 test calls where the caller pushes hard for a number ("just a rough range", "what did my friend pay", "per sq ft?"). **Any number spoken = fail.**

---

## 9. Build phases and rubric

Tick every box before moving to the next phase.

### Phase 1: Foundation
- [ ] Next.js app on GitHub, auto-deploying to Vercel
- [ ] Neon connected, migrations for all tables in section 6.5
- [ ] Env vars documented in `.env.example` (no real secrets committed)
- [ ] `README.md` explains setup in plain steps

### Phase 2: Agent files
- [ ] `/agent` folder complete as in section 5
- [ ] No price numbers anywhere in `/agent` (add a CI check that fails on `₹` followed by digits, or "per sq ft" with a number)
- [ ] Knowledge files contain facts only; rules live in the system prompt

### Phase 3: Call pipeline
- [ ] Vaani webhook verified, idempotent, raw payload stored
- [ ] Every outcome routes correctly (section 6.1)
- [ ] Cal.com webhook updates bookings
- [ ] HubSpot contact, deal and note created correctly; no duplicate contacts for the same phone number
- [ ] Handoff email has every field in section 6.3 and reads well on a phone
- [ ] Complaint alert reaches Nikhil within 1 minute of the call ending
- [ ] Failures show in "Needs attention" and can be retried
- [ ] All 20 fixture tests pass

### Phase 4: Dashboard
- [ ] Home page shows only sections 7.3 a–d
- [ ] Every number is clickable and leads to the calls behind it
- [ ] Works on a 375px-wide phone screen with no horizontal scrolling
- [ ] ₹ in Indian grouping, IST times everywhere
- [ ] Loading, empty and error states written in plain language
- [ ] Owner and Front desk roles work as described
- [ ] Reports page: 6 charts, each with a one-line takeaway
- [ ] Cost numbers match the sum of per-call costs + fixed costs (test with seed data)

### Phase 5: Launch readiness
- [ ] Live test calls for all 20 scenarios logged, with expected = actual
- [ ] Pricing-leak tests: 0 numbers spoken
- [ ] Weekly summary email sends on schedule
- [ ] Seed script creates realistic demo data for one month so the dashboard can be shown without live calls

**Overall pass rule:** every call answered and logged, 0 prices quoted, every qualified lead reaches a designer with a complete note within 5 minutes of the call ending, and Nikhil can see calls, bookings and total cost without asking anyone.

---

## 10. Built to extend (not to build now)

Put source-specific code in `lib/sources/` (`vaani.ts` now; `whatsapp.ts` and `webform.ts` later). Each adapter converts its input into the same `Enquiry` type, and everything after that (routing, HubSpot, emails, dashboard) is shared. Add a `channel` column to `calls` now (value `phone`) so the dashboard can split by channel later without a migration.

---

## 11. Open questions (confirm with Nikhil; keep as settings or TODOs until answered)

1. Is there a minimum size for commercial projects? (Front desk said 500 sq ft in T18, but `services.md` doesn't say.)
2. Do we serve Kharadi and Nanded City? (Not in the service-area list.)
3. Timeline rule: "no projects needing completion in under 6 weeks" vs "execution must be possible within 8–10 weeks". Which wins?
4. Who receives complaint transfers when Nikhil is unavailable?
5. The average project value to use for the pipeline estimate (₹8–14 lakh range given; default ₹11 lakh).
