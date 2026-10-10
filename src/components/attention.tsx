import Link from "next/link";
import { markHandled, retryFailed } from "@/app/actions";
import { formatIst } from "@/lib/time";
import type { AttentionItem } from "@/lib/stats";
import { buttonPrimary, buttonQuiet } from "./ui";

function Row({ item }: { item: AttentionItem }) {
  const { call, kind, message } = item;
  const who = call.callerName ?? call.callerPhone ?? "Unknown caller";
  const urgent = kind === "complaint";

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/calls/${call.id}`} className="font-medium hover:underline">
          {who}
        </Link>
        <p className={`text-sm ${urgent ? "text-urgent" : "text-warn"}`}>{message}</p>
        <p className="text-sm text-muted">{formatIst(call.startedAt)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {(kind === "no_booking" || kind === "callback") && call.callerPhone && (
          <a href={`tel:${call.callerPhone.replace(/\s/g, "")}`} className={buttonPrimary}>
            Call back
          </a>
        )}
        {kind === "failure" && (
          <form action={retryFailed}>
            <input type="hidden" name="id" value={call.id} />
            <button className={buttonPrimary}>Retry</button>
          </form>
        )}
        {kind === "complaint" && (
          <form action={markHandled}>
            <input type="hidden" name="id" value={call.id} />
            <button className={buttonPrimary}>Mark handled</button>
          </form>
        )}
        {(kind === "no_booking" || kind === "callback") && (
          <form action={markHandled}>
            <input type="hidden" name="id" value={call.id} />
            <button className={buttonQuiet}>Mark handled</button>
          </form>
        )}
      </div>
    </li>
  );
}

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <section aria-labelledby="attention-h" className="py-6">
        <h2 id="attention-h" className="sr-only">
          Needs attention
        </h2>
        <p className="text-accent">All clear. Nothing needs your attention right now.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="attention-h" className="py-6">
      <h2 id="attention-h" className="text-[1.7rem] font-medium">
        Needs attention <span className="text-muted">({items.length})</span>
      </h2>
      <ul className="mt-1 divide-y divide-text/10">
        {items.map((i) => (
          <Row key={i.call.id} item={i} />
        ))}
      </ul>
    </section>
  );
}
