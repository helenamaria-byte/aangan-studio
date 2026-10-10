import Link from "next/link";
import { OUTCOME_LABELS } from "@/lib/stats";
import type { Period } from "@/lib/time";

// Each outcome is a small paint chip plus its name, so the meaning never depends on colour alone.
const CHIP: Record<string, string> = {
  qualified_booked: "#4F6B5A",
  qualified_no_booking: "#B08D4B",
  declined: "#A59A8F",
  complaint: "#B42318",
  dropped: "#B7791F",
  spam_or_wrong_number: "#CFC8BF",
};

export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-text/10 bg-bg/70 px-3 py-1 text-sm ${outcome === "complaint" ? "text-urgent" : "text-text"}`}
    >
      <span aria-hidden className="size-3 rounded-full ring-1 ring-black/10" style={{ background: CHIP[outcome ?? ""] ?? "#CFC8BF" }} />
      {OUTCOME_LABELS[outcome ?? ""] ?? "Unknown"}
    </span>
  );
}

/** A section title with a small brass ornament beneath it. */
export function SectionTitle({ id, children, count }: { id?: string; children: React.ReactNode; count?: number }) {
  return (
    <div>
      <h2 id={id} className="text-[1.7rem] font-medium leading-tight">
        {children}
        {count !== undefined && <span className="text-muted"> ({count})</span>}
      </h2>
      <div className="ornament" aria-hidden>
        <i />
      </div>
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
    <nav aria-label="Time period" className="inline-flex rounded-full bg-text/5 p-1 text-sm">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={p.key === "week" ? "/studio" : `/studio?period=${p.key}`}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 ${p.key === current ? "bg-bg font-medium shadow-sm" : "text-muted"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export type Material = "linen" | "sage" | "stone" | "walnut";

export function Stat({ label, value, note, href, material = "linen" }: { label: string; value: string; note: string; href: string; material?: Material }) {
  return (
    <Link href={href} className={`swatch swatch-${material} focus-visible:outline-2 focus-visible:outline-accent`}>
      <div className="pr-4 text-sm text-text/70">{label}</div>
      <div className="font-display mt-1.5 whitespace-nowrap text-[2.5rem] font-medium leading-none tracking-tight sm:text-5xl">
        {value.match(/^(.*?)\s(lakh|crore)$/) ? (
          <>
            {value.replace(/\s(lakh|crore)$/, "")}
            <span className="font-ui ml-1.5 text-base font-normal tracking-normal text-text/70">{value.match(/(lakh|crore)$/)?.[0]}</span>
          </>
        ) : (
          value
        )}
      </div>
      <div className="mt-2.5 text-sm text-text/70">{note}</div>
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
