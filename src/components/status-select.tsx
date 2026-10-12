"use client";

import { setOutcome } from "@/app/actions";
import { CHIP } from "@/components/ui";
import { OUTCOME_LABELS } from "@/lib/stats";

/**
 * The category dropdown on a lead: Booked, Lead, Declined, Complaint, Dropped, Wrong number.
 * Choosing a new one saves straight away. People who may not change it see plain text instead.
 */
export function StatusSelect({ id, outcome }: { id: number; outcome: string | null }) {
  return (
    <form action={setOutcome} className="relative inline-flex items-center">
      <input type="hidden" name="id" value={id} />
      <span aria-hidden className="pointer-events-none absolute left-3 size-2.5 rounded-full" style={{ background: CHIP[outcome ?? ""] ?? "#CFC8BF" }} />
      <select
        name="outcome"
        defaultValue={outcome ?? ""}
        aria-label="Category"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="cursor-pointer appearance-none rounded-full border border-text/15 bg-white py-1.5 pl-8 pr-8 text-sm hover:border-text/30 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {outcome === null && (
          <option value="" disabled>
            Choose a category
          </option>
        )}
        {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <svg aria-hidden className="pointer-events-none absolute right-3" width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M1 1l4 4 4-4" stroke="#7A716B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </form>
  );
}
