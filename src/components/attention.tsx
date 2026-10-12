import Link from "next/link";
import { markHandled, retryFailed } from "@/app/actions";
import { displayName } from "@/components/call-list";
import { formatIst } from "@/lib/time";
import type { AttentionItem } from "@/lib/stats";
import { SectionTitle, buttonPrimary, buttonQuiet, card } from "./ui";

function Row({ item, canAct }: { item: AttentionItem; canAct: boolean }) {
  const { call, kind, message } = item;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/calls/${call.id}`} className="font-medium hover:underline">
          {displayName(call)}
        </Link>
        <p className={`text-sm ${kind === "complaint" ? "text-urgent" : "text-text/80"}`}>{message}</p>
        <p className="text-sm text-muted">{formatIst(call.startedAt)}</p>
      </div>

      {canAct && (
        <div className="flex shrink-0 items-center gap-1">
          {(kind === "no_booking" || kind === "callback") && call.callerPhone && (
            <a href={`tel:${call.callerPhone.replace(/\s/g, "")}`} className={buttonPrimary}>
              Call back
            </a>
          )}
          {kind === "failure" && (
            <form action={retryFailed}>
              <input type="hidden" name="id" value={call.id} />
              <button className={buttonPrimary}>Try again</button>
            </form>
          )}
          <form action={markHandled}>
            <input type="hidden" name="id" value={call.id} />
            <button className={kind === "complaint" ? buttonPrimary : buttonQuiet}>Mark handled</button>
          </form>
        </div>
      )}
    </li>
  );
}

/** What needs a person, in plain words. `canAct` is false for visitors who are only looking. */
export function NeedsAttention({ items, canAct = true }: { items: AttentionItem[]; canAct?: boolean }) {
  return (
    <section aria-labelledby="attention-h">
      <SectionTitle id="attention-h" count={items.length || undefined}>
        Needs attention
      </SectionTitle>
      {items.length === 0 ? (
        <p className={`${card} mt-4 px-5 py-4 text-muted`}>All clear. Nothing needs you right now.</p>
      ) : (
        <ul className={`${card} mt-4 divide-y divide-text/10 px-5`}>
          {items.map((i) => (
            <Row key={i.call.id} item={i} canAct={canAct} />
          ))}
        </ul>
      )}
    </section>
  );
}
