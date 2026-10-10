import type { Enquiry } from "./enquiry";
import { formatIst } from "./time";

// Plain, phone-readable emails. No marketing styling.

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

const UNKNOWN = "Not captured on the call";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function row(label: string, value: string | null | undefined, html?: string) {
  return { label, value: value && value.trim() ? value.trim() : null, html };
}

function render(title: string, intro: string | null, rows: ReturnType<typeof row>[], footer: string[]): BuiltEmail["text"] {
  const lines = [title, ""];
  if (intro) lines.push(intro, "");
  for (const r of rows) lines.push(`${r.label}: ${r.value ?? UNKNOWN}`);
  if (footer.length) lines.push("", ...footer);
  return lines.join("\n");
}

function renderHtml(title: string, intro: string | null, rows: ReturnType<typeof row>[], footer: string[]): string {
  const body = rows
    .map((r) => {
      const v = r.value
        ? (r.html ?? esc(r.value))
        : `<span style="color:#B7791F">${UNKNOWN}</span>`;
      return `<p style="margin:0 0 12px"><span style="color:#7A716B">${esc(r.label)}</span><br>${v}</p>`;
    })
    .join("");
  const foot = footer.map((f) => `<p style="margin:0 0 8px">${f}</p>`).join("");
  return `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#2B2522;max-width:560px">
<h2 style="font-size:18px;font-weight:500;margin:0 0 12px">${esc(title)}</h2>
${intro ? `<p style="margin:0 0 16px">${esc(intro)}</p>` : ""}${body}${foot}</div>`;
}

const telHtml = (phone: string) => `<a href="tel:${esc(phone.replace(/\s/g, ""))}">${esc(phone)}</a>`;

export interface HandoffInput {
  e: Enquiry;
  startsAt: Date;
  locationType: "site" | "studio" | null;
  designerName: string | null;
  hubspotDealUrl: string | null;
  isRepeatCaller: boolean;
}

/** Section 6.3. Fields that were not captured are shown as unknown, never silently dropped (rule 4). */
export function buildHandoffEmail(i: HandoffInput): BuiltEmail {
  const { e } = i;
  const name = e.callerName ?? "New caller";
  const subject = `New consultation: ${name}, ${e.propertyType ?? "property"} in ${e.locality ?? "Pune"}, ${formatIst(i.startsAt)}`;

  const when = `${formatIst(i.startsAt)} IST${i.locationType === "site" ? " (site visit)" : i.locationType === "studio" ? " (at the studio)" : ""}`;
  const property = [e.propertyType, e.sizeSqft ? `${e.sizeSqft} sq ft carpet` : null, e.locality]
    .filter(Boolean)
    .join(", ");
  const decision =
    e.decisionMaker === "yes"
      ? "Caller is the decision-maker"
      : e.decisionMaker === "represented"
        ? "Caller is acting for the decision-maker. Ask that they attend"
        : e.decisionMaker === "unclear"
          ? "Unclear. Confirm at the consultation"
          : null;

  const doubts = [e.doubts, i.isRepeatCaller ? "Repeat caller: an earlier enquiry was not followed up. Handle with care." : null]
    .filter(Boolean)
    .join(" ");

  const asked: string[] = [];
  if (e.callerName) asked.push("name");
  if (e.callerPhone) asked.push("phone");
  if (e.locality) asked.push("locality");
  if (e.propertyType) asked.push("property type");
  if (e.sizeSqft) asked.push("size");
  if (e.scopeSummary) asked.push("scope");
  if (e.timelineText) asked.push("timeline");
  if (e.decisionMaker) asked.push("decision-maker");

  const rows = [
    row("Consultation", when),
    row("Caller", [e.callerName, e.callerPhone].filter(Boolean).join(", ") || null, e.callerPhone ? `${esc(e.callerName ?? "")}${e.callerName ? ", " : ""}${telHtml(e.callerPhone)}` : undefined),
    row("Property", property || null),
    row("What they want", e.scopeSummary),
    row("Timeline", e.timelineText),
    row("Decision-maker", decision),
    ...(e.budgetMentioned ? [row("Budget mentioned by caller", e.budgetMentioned)] : []),
    row("Doubts or things to check", doubts || "None noted"),
  ];

  const links: string[] = [];
  if (i.hubspotDealUrl) links.push(`HubSpot deal: ${i.hubspotDealUrl}`);
  if (e.recordingUrl) links.push(`Recording: ${e.recordingUrl}`);
  if (e.transcriptUrl) links.push(`Transcript: ${e.transcriptUrl}`);

  const footerText = [
    `Already asked on the call. No need to ask again: ${asked.join(", ") || "nothing captured"}.`,
    ...links,
  ];
  const footerHtml = [
    `<strong style="font-weight:500">Already asked on the call. No need to ask again:</strong> ${esc(asked.join(", ") || "nothing captured")}.`,
    ...links.map((l) => {
      const [label, ...rest] = l.split(": ");
      const url = rest.join(": ");
      return `${esc(label)}: <a href="${esc(url)}">${esc(url)}</a>`;
    }),
  ];

  const intro = i.designerName ? `Hi ${i.designerName}, a consultation has been booked for you.` : "A consultation has been booked.";
  return { subject, text: render(subject, intro, rows, footerText), html: renderHtml(subject, intro, rows, footerHtml) };
}

/** Qualified lead that did not get a booking: a person books it next morning. */
export function buildFrontDeskEmail(e: Enquiry, hubspotDealUrl: string | null): BuiltEmail {
  const subject = `Book a consultation: ${e.callerName ?? "caller"}, ${e.locality ?? "Pune"} (no slot booked on the call)`;
  const rows = [
    row("Caller", [e.callerName, e.callerPhone].filter(Boolean).join(", ") || null, e.callerPhone ? `${esc(e.callerName ?? "")}${e.callerName ? ", " : ""}${telHtml(e.callerPhone)}` : undefined),
    row("Property", [e.propertyType, e.sizeSqft ? `${e.sizeSqft} sq ft carpet` : null, e.locality].filter(Boolean).join(", ") || null),
    row("What they want", e.scopeSummary),
    row("Timeline", e.timelineText),
    row("Doubts or things to check", e.doubts ?? "None noted"),
    row("Call summary", e.summary),
  ];
  const footer = [
    "Please call this lead and book the consultation first thing in the next working morning.",
    ...(hubspotDealUrl ? [`HubSpot deal: ${hubspotDealUrl}`] : []),
    ...(e.recordingUrl ? [`Recording: ${e.recordingUrl}`] : []),
  ];
  const footerHtml = footer.map(esc);
  return { subject, text: render(subject, null, rows, footer), html: renderHtml(subject, null, rows, footerHtml) };
}

/** Section 6.4: subject starts with "Urgent:". */
export function buildComplaintEmail(e: Enquiry, hubspotContactUrl: string | null): BuiltEmail {
  const subject = `Urgent: complaint from ${e.callerName ?? "an existing client"}`;
  const rows = [
    row("Name", e.callerName),
    row("Phone", e.callerPhone, e.callerPhone ? telHtml(e.callerPhone) : undefined),
    row("Designer", extractDesigner(e)),
    row("Issue", e.summary ?? e.scopeSummary),
    row("Call time", `${formatIst(e.startedAt)} IST`),
  ];
  const footer = [
    "The caller was offered a transfer to you, or a callback from a senior person within 15 minutes.",
    ...(hubspotContactUrl ? [`HubSpot contact: ${hubspotContactUrl}`] : []),
    ...(e.recordingUrl ? [`Recording: ${e.recordingUrl}`] : []),
  ];
  return { subject, text: render(subject, null, rows, footer), html: renderHtml(subject, null, rows, footer.map(esc)) };
}

/** The agent notes the designer's name in the post-call summary or doubts; the fields list has no slot for it. */
function extractDesigner(e: Enquiry): string | null {
  const hay = `${e.doubts ?? ""} ${e.summary ?? ""}`;
  const m = hay.match(/designer(?: name)?(?: is|:)?\s+([A-Z][a-z]+)/);
  return m ? m[1] : null;
}
