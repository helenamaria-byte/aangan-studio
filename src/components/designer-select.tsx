"use client";

import { setDesigner } from "@/app/actions";

/** Owner and front desk: change which designer a lead belongs to. */
export function DesignerSelect({ id, current, designers }: { id: number; current: number | null; designers: { id: number; name: string }[] }) {
  return (
    <form action={setDesigner} className="inline-flex items-center">
      <input type="hidden" name="id" value={id} />
      <select
        name="designerId"
        defaultValue={current ?? ""}
        aria-label="Designer"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="cursor-pointer rounded-full border border-text/15 bg-white py-1.5 pl-3 pr-2 text-sm hover:border-text/30 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {current === null && (
          <option value="" disabled>
            Not given yet
          </option>
        )}
        {designers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </form>
  );
}
