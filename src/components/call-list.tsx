import Link from "next/link";
import { OutcomeBadge } from "@/components/ui";
import { StatusSelect } from "@/components/status-select";
import { formatIst } from "@/lib/time";
import type { CallView } from "@/lib/stats";

/** What to call someone on screen. A missing name is never shown as "unknown". */
export const displayName = (c: Pick<CallView, "callerName" | "callerPhone">) => c.callerName ?? c.callerPhone ?? "New caller";

/**
 * A clean list of calls. Each row: who and when on the left, the assigned designer and the category on the right.
 * `canEdit` turns the category into a dropdown. `designerNames` (id to name) shows who each lead went to.
 */
export function CallList({
  calls,
  canEdit = false,
  designerNames,
}: {
  calls: CallView[];
  canEdit?: boolean;
  designerNames?: Record<number, string>;
}) {
  return (
    <ul className="divide-y divide-text/10">
      {calls.map((c) => {
        const designer = c.assignedDesignerId && designerNames ? designerNames[c.assignedDesignerId] : null;
        return (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
            <Link href={`/calls/${c.id}`} className="min-w-0 flex-1 basis-56 hover:opacity-80">
              <div className="truncate font-medium">{displayName(c)}</div>
              <div className="truncate text-sm text-muted">
                {formatIst(c.startedAt)}
                {c.locality ? ` · ${c.locality}` : ""}
              </div>
            </Link>
            <div className="flex items-center gap-4">
              {designer && <span className="hidden text-sm text-muted sm:inline">{designer}</span>}
              {canEdit ? <StatusSelect id={c.id} outcome={c.outcome} /> : <OutcomeBadge outcome={c.outcome} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
