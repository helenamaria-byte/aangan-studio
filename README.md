# Aangan Studio: AI phone enquiry system

Answers every call to the studio with a Vaani.ai voice agent, books a consultation through Cal.com, emails the designer a complete handoff note, logs the lead in HubSpot, and shows Nikhil a simple dashboard of what it did and what it cost.

The full requirements are in `aangan-build-spec.md`. This repo is built in the phase order given there.

**Status:** Phases 1 to 4 are built: foundation, agent files, call pipeline, and dashboard. Phase 5 (live test calls, weekly summary email, launch checks) is next. Everything is tested against fixtures and an in-memory database, but has not yet run against live Neon, HubSpot, Resend, Vaani or Cal.com. See "Connecting the live services".

## The one rule

The system never states a price. No number, range or per-square-foot figure. Pricing documents must never be added to `/agent` or sent to Vaani. `npm run check:no-prices` runs in CI and fails if a figure appears in `/agent`.

## What is in the repo

| Folder | What it holds |
|---|---|
| `agent/` | Everything pasted or uploaded into Vaani: system prompt, knowledge files, tool setup, post-call fields |
| `src/app/` | The Next.js app: dashboard and webhook routes |
| `src/db/` | Neon database schema (Drizzle) |
| `src/lib/` | Shared code. `sources/` holds one adapter per input channel |
| `drizzle/` | Generated database migrations |
| `scripts/` | Helper scripts, including the price check |
| `tests/` | Fixtures and the live-call test log |

## Setup, step by step

1. **Install Node 22 or newer**, then run `npm install`.
2. **Create a Neon project** at neon.tech. Copy the connection string.
3. **Create your local settings:** copy `.env.example` to `.env.local` and paste the Neon string as `DATABASE_URL`. The other values can wait until the phase that needs them.
4. **Create the tables:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
5. **Run it:** `npm run dev`, then open http://localhost:3000.
6. **Deploy:** import this GitHub repo into Vercel. Add every variable from `.env.example` under Settings, Environment Variables. Every push to `main` deploys automatically.
7. **Set up Vaani:** follow `agent/tools.md`, paste `agent/system-prompt.md`, upload the four files in `agent/knowledge/`.

## How a call flows

1. Cal.com books the slot **during** the call and sends its webhook to `/api/webhooks/calcom`. The booking is saved with the caller's phone number.
2. When the call ends, Vaani sends its webhook to `/api/webhooks/vaani`. The raw payload is saved first, then parsed.
3. Routing by outcome (`src/lib/plan.ts`): booked leads get a HubSpot contact, deal and note, plus the designer handoff email. Leads with no booking go to the front desk. Complaints email Nikhil first, before anything else. Declined callers get a HubSpot contact only. Dropped calls under 60 seconds show as "Needs callback".
4. Either webhook can arrive first. Whichever comes second sends the handoff email.
5. Every external call is tried 3 times. If it still fails, the call is flagged `needs_attention` with the error. The lead is never lost.

## The dashboard

Sign in with an email link (no password). Who may sign in is set on the Settings page, or by `OWNER_EMAIL` and `FRONT_DESK_EMAIL` until then.

| Page | Owner | Front desk |
|---|---|---|
| Home: one sentence, four numbers, needs attention, latest calls | everything | no pipeline value, no costs |
| Calls: search, filters, CSV download | yes | yes, without the cost column |
| Call detail | yes | yes, without costs |
| Reports: six charts | yes | no |
| Settings | yes | no |

**Needs attention** lists complaints, qualified leads with no booking, dropped calls that need a callback, failed emails or CRM updates, and any booked call whose designer email has not gone out after 5 minutes. Each row has one action: Mark handled, Call back, or Retry.

## Try it without any accounts

The dashboard can run on an embedded local database with a month of demo data. This is for development only and is never used on Vercel.

```bash
npm install
```
Create `.env.local` with these lines (they are git-ignored):
```
DATABASE_URL=pglite://.pglite
OWNER_EMAIL=you@example.test
SEED_OWNER_EMAIL=you@example.test
AUTH_SECRET=any-long-random-text-at-least-32-characters
APP_URL=http://localhost:3000
```
Then:
```bash
npm run seed
npm run dev
```
Open http://localhost:3000, enter your email, and the sign-in link is printed in the terminal (no email service needed locally). To use the real database instead, put your Neon address in `DATABASE_URL` and run `npm run seed` once if you want demo data. Demo rows are all marked `seed-` and `@example.invalid`, and running the seed again replaces only those.

## Connecting the live services

Do these in order. Each has a quick check.

1. **Resend:** verify your sending domain, set `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`, `FRONT_DESK_EMAIL`.
2. **HubSpot:** create a private app with contacts and deals read/write. Create the contact property `aangan_decline_reason` (single-line text). Create deal stages "Consultation booked" and "New lead", then copy their IDs into `HUBSPOT_STAGE_*`.
3. **Cal.com:** add a webhook to `https://<your-domain>/api/webhooks/calcom` for booking created, rescheduled and cancelled, with a secret in `CALCOM_WEBHOOK_SECRET`. Make a test booking and confirm the phone number and location arrive. Adjust `parseCalcom` in `src/lib/calcom.ts` if the field names differ.
4. **Vaani:** point the end-of-call webhook at `/api/webhooks/vaani` with the secret. Make a test call, then compare Vaani's real payload against `src/lib/sources/vaani.ts` and `scripts/gen-fixtures.mjs`. These are the only two places that assume the shape. Re-run `npm run gen:fixtures && npm test` after changing them.

## Tests

`npm test` runs 125 checks:

- one fake Vaani payload for each of the 20 September phone transcripts (`tests/fixtures/`): outcomes, routing, and email completeness;
- the full pipeline against a real in-memory Postgres with HubSpot and Resend faked: repeat deliveries, either webhook arriving first, retries, failures showing under Needs attention, and the complaint alert going out first;
- every dashboard number, including cost = per-call costs + fixed costs, IST periods, Indian formats, and CSV safety;
- sign-in link and session security.

## Secrets

All secrets live in Vercel environment variables (or `.env.local` on your machine, which is git-ignored). Never put a key in code.

## Open questions for Nikhil

Marked as `TODO for Nikhil` in the agent files and listed in section 11 of the spec. Current defaults: Kharadi and Nanded City are checked with the team rather than declined; execution must be possible within 8 to 10 weeks and never under 6; average project value is ₹11 lakh (a setting).
