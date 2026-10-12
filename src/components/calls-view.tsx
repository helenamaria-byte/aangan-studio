import Link from "next/link";
import { CallList } from "@/components/call-list";
import { buttonPrimary, buttonQuiet, card, inputClass } from "@/components/ui";
import { parseCallFilters } from "@/lib/params";
import { filterCalls, OUTCOME_LABELS, type CallView } from "@/lib/stats";

const PAGE = 50;

/** The calls list. `all` is already limited to what this person may see. */
export function CallsView({
  all,
  sp,
  title,
  designerNames,
  canEdit,
  canExport,
}: {
  all: CallView[];
  sp: Record<string, string | string[] | undefined>;
  title: string;
  designerNames?: Record<number, string>;
  canEdit: boolean;
  canExport: boolean;
}) {
  const f = parseCallFilters(sp);
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const rows = filterCalls(all, f);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  const filterQs = new URLSearchParams(Object.entries(f.raw).filter(([, v]) => v) as [string, string][]);
  const pageHref = (p: number) => {
    const qs = new URLSearchParams(filterQs);
    qs.set("page", String(p));
    return `/calls?${qs}`;
  };
  const exportHref = `/calls/export${filterQs.toString() ? `?${filterQs}` : ""}`;
  const hasFilters = filterQs.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[2.4rem] font-medium leading-tight">{title}</h1>
        {canExport && (
          <a href={exportHref} className="text-sm text-accent hover:underline" download>
            Download as spreadsheet
          </a>
        )}
      </div>

      <form action="/calls" role="search" className={`${card} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]`}>
        <div>
          <label htmlFor="q" className="sr-only">
            Search by name, number or area
          </label>
          <input id="q" name="q" defaultValue={f.raw.q} placeholder="Search by name, number or area" className={inputClass} />
        </div>
        <div>
          <label htmlFor="outcome" className="sr-only">
            Category
          </label>
          <select id="outcome" name="outcome" defaultValue={f.raw.outcome} className={inputClass}>
            <option value="">All categories</option>
            {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hours" className="sr-only">
            Time of day
          </label>
          <select id="hours" name="hours" defaultValue={f.raw.hours} className={inputClass}>
            <option value="">Any time</option>
            <option value="day">Office hours</option>
            <option value="after">After hours</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="sr-only">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={f.raw.from} className={inputClass} aria-label="From date" />
        </div>
        <div>
          <label htmlFor="to" className="sr-only">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={f.raw.to} className={inputClass} aria-label="To date" />
        </div>
        <div className="flex items-center gap-2 sm:col-span-5">
          <button className={buttonPrimary}>Show</button>
          {hasFilters && (
            <Link href="/calls" className={buttonQuiet}>
              Clear
            </Link>
          )}
          <span className="ml-auto text-sm text-muted" aria-live="polite">
            {rows.length} {rows.length === 1 ? "call" : "calls"}
          </span>
        </div>
      </form>

      {shown.length === 0 ? (
        <p className={`${card} px-5 py-6 text-muted`}>{hasFilters ? "Nothing matches these filters. Try clearing one." : "Nothing here yet."}</p>
      ) : (
        <div className={`${card} px-5`}>
          <CallList calls={shown} canEdit={canEdit} designerNames={designerNames} />
        </div>
      )}

      {rows.length > PAGE && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-accent hover:underline">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {Math.ceil(rows.length / PAGE)}
          </span>
          {page * PAGE < rows.length ? (
            <Link href={pageHref(page + 1)} className="text-accent hover:underline">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
