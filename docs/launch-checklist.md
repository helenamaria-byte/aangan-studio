# Launch checklist

Work top to bottom. Do not go live until every box in sections 1 to 6 is ticked. The overall pass rule from the spec is at the end.

## 1. Accounts and keys

- [ ] GitHub repo connected to Vercel, deploying on every push to `main`
- [ ] Neon project created. `DATABASE_URL` set in Vercel. Tables created: `npm run db:migrate` against the Neon address
- [ ] Resend: sending domain verified, `RESEND_API_KEY` and `EMAIL_FROM` set
- [ ] HubSpot private app created (contacts and deals, read and write). `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_PORTAL_ID` set
- [ ] HubSpot contact property `aangan_decline_reason` created
- [ ] HubSpot deal stages "Consultation booked", "New lead" and a cancelled stage created. Their IDs are in `HUBSPOT_STAGE_BOOKED`, `HUBSPOT_STAGE_NEW`, `HUBSPOT_STAGE_CANCELLED`
- [ ] Cal.com: round-robin team event "Consultation" across every active designer. Webhook to `/api/webhooks/calcom` with `CALCOM_WEBHOOK_SECRET`
- [ ] Vaani: agent created, end-of-call webhook to `/api/webhooks/vaani` with `VAANI_WEBHOOK_SECRET`
- [ ] `AUTH_SECRET` (32+ random characters), `APP_URL` (the real address), `CRON_SECRET`, `OWNER_EMAIL`, `FRONT_DESK_EMAIL`, `STUDIO_PHONE` set
- [ ] **Never** `DATABASE_URL=pglite://...` in Vercel. That is for a laptop only
- [ ] No secret appears in the repo: search the code for keys before launch

## 2. Agent setup (see `agent/tools.md`)

- [ ] `agent/system-prompt.md` pasted into Vaani, and the four `agent/knowledge/` files uploaded. **Nothing else** uploaded: no pricing guide, no transcripts
- [ ] Post-call fields from `agent/post-call-fields.md` configured
- [ ] Cal.com availability and transfer-to-Nikhil tools configured
- [ ] Languages: English, Hindi, Marathi
- [ ] `npm run check:no-prices` passes (also runs on every push)

## 3. Answers needed from Nikhil (the agent files hold safe defaults until then)

- [ ] Do we serve **Kharadi** and **Nanded City**? Update `agent/knowledge/02-service-area.md` and the system prompt
- [ ] **Commercial minimum size.** Is it 500 sq ft? Update `agent/knowledge/01-services.md` and the "too small" rule
- [ ] **Timeline rule.** Under 6 weeks never works, execution within 8 to 10 weeks. Confirm this is the rule in every case
- [ ] **Working days.** Is Saturday an office day? Set it under Settings, Office hours
- [ ] **Who takes complaint transfers when Nikhil is unavailable?** Put that number in Vaani
- [ ] **Average project value** for the pipeline estimate (default ₹11 lakh). Set it under Settings, Money
- [ ] Monthly cost of each tool entered under Settings, Money
- [ ] Anyone who should sign in is added under Settings, Who can sign in

## 4. Tests that run in code (all must pass)

- [ ] `npm test` passes (fixtures for T01 to T20, the pipeline against a real database, every dashboard number, security, weekly summary)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## 5. Tests that need people on phones (`tests/agent-test-log.md`)

- [ ] All 20 September scenarios called live. Expected matches actual on every one
- [ ] At least 5 pricing-leak calls. **0 numbers spoken.** Every transcript run through `npm run check:leak`
- [ ] Complaint alert reaches Nikhil within 1 minute (measured)
- [ ] Every booked call's handoff email reaches the designer within 5 minutes with a complete note (measured)
- [ ] Hindi and Marathi calls checked

## 6. Dashboard walk-through on a real phone

- [ ] Sign in with a magic link on a phone. Works with the real email
- [ ] Home page shows the sentence, four numbers, Needs attention, latest calls, with no sideways scrolling
- [ ] Owner can open Reports and Settings. Front desk cannot, and sees no costs
- [ ] Mark handled, Call back and Retry all work on a real failure (turn Resend off briefly to test Retry)
- [ ] Weekly summary: open `/api/cron/weekly-summary` with the cron secret once (`curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/weekly-summary`) and check the email that arrives
- [ ] Vercel shows the cron job for Monday 09:00 IST (03:30 UTC)

## 7. Demo data

- [ ] To show the dashboard before real calls: `npm run seed` against a **separate** Neon branch or a local database, not the live one. Demo rows are marked `seed-`. Running it again replaces only demo rows

## 8. Overall pass rule (from the spec)

Ready to launch when all of these are true:

- [ ] Every call is answered and logged
- [ ] 0 prices quoted
- [ ] Every qualified lead reaches a designer with a complete note within 5 minutes of the call ending
- [ ] Nikhil can see calls, bookings and total cost without asking anyone

## After launch: first week

- [ ] Check Needs attention every morning for the first week
- [ ] Read five real transcripts for tone and for any number spoken
- [ ] If Vaani's extraction misses fields, switch `EXTRACTION_MODE=llm` and re-test
- [ ] Compare Vaani's real webhook payload with `src/lib/sources/vaani.ts`. Compare Cal.com's with `src/lib/calcom.ts`
