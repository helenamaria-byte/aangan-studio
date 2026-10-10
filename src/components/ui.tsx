import Link from "next/link";
import { OUTCOME_LABELS } from "@/lib/stats";
import type { Period } from "@/lib/time";

const BADGE: Record<string, string> = {
  qualified_booked: "bg-accent/10 text-accent",
  qualified_no_booking: "bg-text/5 text-text",
  declined: "bg-text/5 text-muted",
  complaint: "bg-urgent/10 text-urgent",
  dropped: "bg-warn/10 text-warn",
  spam_or_wrong_number: "bg-text/5 text-muted",
};

export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm ${BADGE[outcome ?? ""] ?? "bg-text/5 text-muted"}`}>
      {OUTCOME_LABELS[outcome ?? ""] ?? "Unknown"}
    </span>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export function PeriodToggle({ current }: { current: Period }) {
  return (
    <nav aria-label="Time period" className="inline-flex rounded-full bg-text/5 p-1 text-sm">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={p.key === "week" ? "/" : `/?period=${p.key}`}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 ${p.key === current ? "bg-bg font-medium shadow-sm" : "text-muted"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export function Stat({ label, value, note, href }: { label: string; value: string; note: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg py-3 pr-2 hover:bg-text/[0.03] focus-visible:outline-2 focus-visible:outline-accent">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-medium tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted">{note}</div>
    </Link>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <p role="status" className={`rounded-lg px-4 py-3 text-sm ${tone === "success" ? "bg-accent/10 text-accent" : "bg-urgent/10 text-urgent"}`}>
      {children}
    </p>
  );
}

export const buttonPrimary =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const buttonQuiet =
  "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent";
export const inputClass =
  "w-full rounded-lg border border-text/15 bg-bg px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-accent";
