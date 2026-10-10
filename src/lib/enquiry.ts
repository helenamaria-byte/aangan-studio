// The one shape every input source (phone now; WhatsApp and web form later) converts into.
// Routing, HubSpot, emails and the dashboard only ever see this type.

export type Channel = "phone" | "whatsapp" | "webform";

export type Outcome =
  | "qualified_booked"
  | "qualified_no_booking"
  | "declined"
  | "complaint"
  | "dropped"
  | "spam_or_wrong_number";

export type DeclineReason =
  | "advice_only"
  | "out_of_area"
  | "timeline"
  | "budget"
  | "out_of_scope_type"
  | "too_small"
  | "other";

export type PropertyType = "apartment" | "house" | "villa" | "office" | "clinic" | "other";

export interface Enquiry {
  channel: Channel;
  sourceId: string; // Vaani call ID for phone. Used as the idempotency key.
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  callerName: string | null;
  callerPhone: string | null;
  locality: string | null;
  propertyType: PropertyType | null;
  sizeSqft: number | null;
  scopeSummary: string | null;
  timelineText: string | null;
  decisionMaker: "yes" | "represented" | "unclear" | null;
  budgetMentioned: string | null;
  outcome: Outcome | null;
  declineReason: DeclineReason | null;
  doubts: string | null;
  language: string | null;
  summary: string | null;
  transcriptUrl: string | null;
  recordingUrl: string | null;
  costs: { voiceInr: number; telephonyInr: number; llmInr: number };
  raw: unknown;
}
