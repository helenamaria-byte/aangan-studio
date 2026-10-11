# Post-call fields

Configure these as **entity extraction** fields in Vaani (Agent Config, Analysis tab). They arrive in the webhook as `data.entities`. The webhook reads them in `src/lib/sources/vaani.ts`. If Vaani's extraction proves unreliable in testing, set `EXTRACTION_MODE=llm` and the webhook extracts the same fields from the transcript instead.

| Field | Type | Allowed values / notes |
|---|---|---|
| caller_name | text | |
| caller_phone | text | Asked for and confirmed on the call. Web calls have no caller ID |
| locality | text | Pune or PCMC locality |
| property_type | enum | apartment, house, villa, office, clinic, other |
| size_sqft | number | Carpet area. Null if unknown |
| scope_summary | text | What they want done, in one or two lines |
| timeline_text | text | The caller's own words |
| decision_maker | enum | yes, represented, unclear |
| budget_mentioned | text or null | Only if the caller volunteered it. Never prompted |
| outcome | enum | qualified_booked, qualified_no_booking, declined, complaint, dropped, spam_or_wrong_number |
| decline_reason | enum or null | advice_only, out_of_area, timeline, budget, out_of_scope_type, too_small, other. Null unless outcome is declined |
| doubts | text | Anything the designer should check: unclear decision-maker, repeat caller, unconfirmed area |
| language | text | The main language of the call |
| summary | text | Three sentences at most |

## Rules for the analysis prompt
- Outcome is `qualified_booked` only if a booking was actually created in Cal.com.
- An existing client with a problem is always `complaint`, never a lead.
- A call that ends before enough was collected is `dropped`.
- Never invent a value. Use null when it was not said.
