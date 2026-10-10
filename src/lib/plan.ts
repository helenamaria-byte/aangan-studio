import type { Enquiry } from "./enquiry";

// Section 6.1 step 5: what to do for each outcome. Pure, so every outcome is testable without any network.

export type HubspotAction =
  | { kind: "deal"; stage: "booked" | "new" }
  | { kind: "contact_only"; declineReason: string | null }
  | { kind: "note_on_existing" }
  | { kind: "none" };

export type EmailKind = "handoff" | "front_desk" | "complaint";

export interface Plan {
  hubspot: HubspotAction;
  emails: EmailKind[];
  /** Shown in "Needs attention" until a human acts. */
  attention: string | null;
}

const CALLBACK_UNDER_SEC = 60;

export function planActions(e: Pick<Enquiry, "outcome" | "durationSec" | "declineReason">): Plan {
  switch (e.outcome) {
    case "qualified_booked":
      return { hubspot: { kind: "deal", stage: "booked" }, emails: ["handoff"], attention: null };
    case "qualified_no_booking":
      return {
        hubspot: { kind: "deal", stage: "new" },
        emails: ["front_desk"],
        attention: "Qualified lead with no booking yet",
      };
    case "complaint":
      // Always alert Nikhil, even if the live transfer worked.
      return {
        hubspot: { kind: "note_on_existing" },
        emails: ["complaint"],
        attention: "Complaint not yet handled",
      };
    case "declined":
      return {
        hubspot: { kind: "contact_only", declineReason: e.declineReason ?? "other" },
        emails: [],
        attention: null,
      };
    case "dropped":
      return {
        hubspot: { kind: "none" },
        emails: [],
        attention:
          e.durationSec !== null && e.durationSec < CALLBACK_UNDER_SEC ? "Needs callback" : null,
      };
    case "spam_or_wrong_number":
      return { hubspot: { kind: "none" }, emails: [], attention: null };
    default:
      // Rule 2: every call gets a logged outcome. An unreadable outcome is a failure to surface, not to hide.
      return {
        hubspot: { kind: "none" },
        emails: [],
        attention: "Call outcome could not be read. Check the call and set it by hand",
      };
  }
}
