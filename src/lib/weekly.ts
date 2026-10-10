import type { BuiltEmail } from "./emails";
import { formatCount, formatInr, formatInrShort } from "./format";
import type { AppSettings } from "./settings";
import { attentionItems, homeStats, type CallView } from "./stats";
import { formatIst, istDateKey, periodRange } from "./time";

// Monday 9am IST: how the week that just ended went. The same four numbers as the dashboard home,
// plus anything that still needs attention.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildWeeklySummary(
  all: CallView[],
  settings: AppSettings,
  now: Date,
  dashboardUrl: string,
): { email: BuiltEmail; weekKey: string } {
  // Ask for "this week" as of the last millisecond of last week, so the numbers cover Monday to Sunday just ended.
  const thisWeek = periodRange("week", now);
  const asOf = new Date(thisWeek.start.getTime() - 1);
  const s = homeStats(all, settings, "week", asOf);
  const range = periodRange("week", asOf);
  const weekKey = istDateKey(range.start); // the Monday that week started

  const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
  const delta = s.booked - s.prevBooked;
  const vs = delta === 0 ? "same as the week before" : `${delta > 0 ? "+" : "-"}${Math.abs(delta)} vs the week before`;
  const answeredPct = s.total ? Math.round((s.answered / s.total) * 100) : 100;

  const headline =
    s.total === 0
      ? "There were no calls last week."
      : `Last week the agent answered ${formatCount(s.answered)} of ${formatCount(s.total)} ${s.total === 1 ? "call" : "calls"}, including ${formatCount(s.afterHours)} after hours, and booked ${plural(s.booked, "consultation", "consultations")}.`;

  const numbers: [string, string, string][] = [
    ["Calls answered", formatCount(s.answered), `${answeredPct}% answered, ${formatCount(s.afterHours)} after hours`],
    ["Consultations booked", formatCount(s.booked), vs],
    ["Est. pipeline value", formatInrShort(s.pipelineInr), `${s.booked} bookings x avg ${formatInrShort(settings.averageProjectValueInr)} (an estimate)`],
    ["Cost last week", formatInr(s.totalCostInr), s.costPerBookedInr === null ? "No bookings" : `${formatInr(s.costPerBookedInr)} per booked consultation`],
  ];

  const items = attentionItems(all, now);
  const attentionText = items.length
    ? items.map((i) => `- ${i.call.callerName ?? i.call.callerPhone ?? "Unknown caller"}: ${i.message} (${formatIst(i.call.startedAt)})`).join("\n")
    : "All clear. Nothing needs attention.";

  const subject = `Aangan weekly summary: ${plural(s.booked, "consultation", "consultations")} booked, ${formatCount(s.answered)} ${s.answered === 1 ? "call" : "calls"} answered`;

  const text = [
    headline,
    "",
    ...numbers.map(([l, v, n]) => `${l}: ${v} (${n})`),
    "",
    items.length ? `Needs attention (${items.length}):` : "Needs attention:",
    attentionText,
    "",
    `Open the dashboard: ${dashboardUrl}`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#2B2522;max-width:560px">
<p style="font-size:18px;margin:0 0 16px">${esc(headline)}</p>
${numbers
  .map(([l, v, n]) => `<p style="margin:0 0 12px"><span style="color:#7A716B">${esc(l)}</span><br><span style="font-size:22px">${esc(v)}</span><br><span style="color:#7A716B;font-size:14px">${esc(n)}</span></p>`)
  .join("")}
<h3 style="font-size:16px;font-weight:500;margin:20px 0 8px">${items.length ? `Needs attention (${items.length})` : "Needs attention"}</h3>
${
  items.length
    ? `<ul style="padding-left:18px;margin:0">${items.map((i) => `<li style="margin-bottom:6px">${esc(i.call.callerName ?? i.call.callerPhone ?? "Unknown caller")}: ${esc(i.message)}<br><span style="color:#7A716B;font-size:14px">${esc(formatIst(i.call.startedAt))}</span></li>`).join("")}</ul>`
    : `<p style="color:#4F6B5A;margin:0">All clear. Nothing needs attention.</p>`
}
<p style="margin-top:20px"><a href="${esc(dashboardUrl)}">Open the dashboard</a></p></div>`;

  return { email: { subject, text, html }, weekKey };
}
