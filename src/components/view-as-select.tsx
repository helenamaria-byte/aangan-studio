"use client";

import { switchView } from "@/app/actions";

/** Owner only: look at the dashboard the way one of the designers sees it. */
export function ViewAsSelect({ designers, current }: { designers: { id: number; name: string }[]; current: number | null }) {
  return (
    <form action={switchView} className="flex items-center gap-2 text-sm">
      <label htmlFor="view-as" className="text-muted">
        View as
      </label>
      <select
        id="view-as"
        name="designerId"
        defaultValue={current ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="cursor-pointer rounded-full border border-text/15 bg-white py-1.5 pl-3 pr-2 text-sm hover:border-text/30 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="">Everyone</option>
        {designers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </form>
  );
}
