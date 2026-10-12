import Link from "next/link";
import { OUTCOME_LABELS } from "@/lib/stats";
import type { Period } from "@/lib/time";

// One calm card style used everywhere: white, hairline border, generous padding, no shadows.
export const card = "rounded-2xl border border-text/10 bg-white/70";

// Each outcome has a small colour dot beside its name, so meaning never depends on colour alone.
export const CHIP: Record<string, string> = {
  qualified_booked: "#4F6B5A",
  qualified_no_booking: "#B08D4B",
  declined: "#A59A8F",
  complaint: "#B42318",
  dropped: "#B7791F",
  spam_or_wrong_number: "#CFC8BF",
};

/** The category as plain text. Used where nobody is allowed to change it. */
export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className="size-2.5 rounded-full" style={{ background: CHIP[outcome ?? ""] ?? "#CFC8BF" }} />
      {OUTCOME_LABELS[outcome ?? ""] ?? "Uncategorised"}
    </span>
  );
}

/** A section title in the display serif, with an optional action on the right. */
export function SectionTitle({
  id,
  children,
  count,
  action,
}: {
  id?: string;
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-[1.6rem] font-medium leading-tight">
        {children}
        {count !== undefined && <span className="ml-2 font-sans text-base text-muted">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export function PeriodToggle({ current }: { current: Period }) {
  return (
    <nav aria-label="Time period" className="inline-flex rounded-full border border-text/10 bg-white/60 p-1 text-sm">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={p.key === "week" ? "/studio" : `/studio?period=${p.key}`}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 ${p.key === current ? "bg-text font-medium text-bg" : "text-muted hover:text-text"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

/** One of the key numbers on Home. */
export function Stat({ label, value, note, href }: { label: string; value: string; note?: string; href: string }) {
  const [, big, unit] = value.match(/^(.*?)\s(lakh|crore)$/) ?? [null, value, null];
  return (
    <Link href={href} className={`${card} block p-5 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-accent`}>
      <div className="text-sm text-muted">{label}</div>
      <div className="font-display mt-2 whitespace-nowrap text-[2.4rem] font-medium leading-none tracking-tight sm:text-[2.7rem]">
        {big}
        {unit && <span className="font-ui ml-1.5 text-base font-normal tracking-normal text-muted">{unit}</span>}
      </div>
      {note && <div className="mt-3 text-sm text-muted">{note}</div>}
    </Link>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <p role="status" className={`rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-accent/10 text-accent" : "bg-urgent/10 text-urgent"}`}>
      {children}
    </p>
  );
}

export const buttonPrimary =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const buttonQuiet =
  "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent";
export const inputClass =
  "w-full rounded-xl border border-text/15 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-accent";
