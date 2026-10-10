import Link from "next/link";
import { formatIst } from "@/lib/time";
import type { CallView } from "@/lib/stats";
import { OutcomeBadge } from "./ui";

export function CallList({ calls }: { calls: CallView[] }) {
  return (
    <ul className="divide-y divide-text/10">
      {calls.map((c) => (
        <li key={c.id}>
          <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-text/[0.03]">
            <div className="min-w-0">
              <div className="truncate font-medium">{c.callerName ?? c.callerPhone ?? "Unknown caller"}</div>
              <div className="truncate text-sm text-muted">
                {formatIst(c.startedAt)}
                {c.locality ? ` · ${c.locality}` : ""}
                {c.isAfterHours ? " · after hours" : ""}
              </div>
            </div>
            <OutcomeBadge outcome={c.outcome} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
