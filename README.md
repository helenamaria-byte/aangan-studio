# Aangan Studio: AI phone enquiry system

Answers every call to the studio with a Vaani.ai voice agent, books a consultation through Cal.com, emails the designer a complete handoff note, logs the lead in HubSpot, and shows Nikhil a simple dashboard of what it did and what it cost.

The full requirements are in `aangan-build-spec.md`. This repo is built in the phase order given there.

**Status:** Phase 1 (foundation) and Phase 2 (agent files) are done. The call pipeline and dashboard are next.

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

## Secrets

All secrets live in Vercel environment variables (or `.env.local` on your machine, which is git-ignored). Never put a key in code.

## Open questions for Nikhil

Marked as `TODO for Nikhil` in the agent files and listed in section 11 of the spec. Current defaults: Kharadi and Nanded City are checked with the team rather than declined; execution must be possible within 8 to 10 weeks and never under 6; average project value is ₹11 lakh (a setting).
