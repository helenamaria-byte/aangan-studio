import type { CallFilters } from "./stats";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** yyyy-mm-dd read as an IST calendar day. */
function istDay(v: string | undefined, endExclusive = false): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return undefined;
  return endExclusive ? new Date(d.getTime() + 86_400_000) : d;
}

export function parseCallFilters(sp: SP): CallFilters & { raw: { q: string; outcome: string; hours: string; from: string; to: string } } {
  const q = one(sp.q) ?? "";
  const outcome = one(sp.outcome) ?? "";
  const hours = one(sp.hours) ?? "";
  const from = one(sp.from) ?? "";
  const to = one(sp.to) ?? "";
  return {
    q: q || undefined,
    outcome: outcome || undefined,
    hours: hours === "day" || hours === "after" ? hours : undefined,
    from: istDay(from),
    to: istDay(to, true),
    raw: { q, outcome, hours, from, to },
  };
}

export function callsHref(params: Record<string, string | undefined>, base = ""): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}/calls?${s}` : `${base}/calls`;
}
