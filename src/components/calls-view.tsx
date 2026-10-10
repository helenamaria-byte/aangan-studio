import Link from "next/link";
import { CallList } from "@/components/call-list";
import { buttonPrimary, buttonQuiet, inputClass } from "@/components/ui";
import { parseCallFilters } from "@/lib/params";
import { filterCalls, OUTCOME_LABELS, type CallView } from "@/lib/stats";

const PAGE = 50;

/** The calls list of the signed-in dashboard. */
export function CallsView({
  all,
  sp,
}: {
  all: CallView[];
  sp: Record<string, string | string[] | undefined>;
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
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-4xl font-medium">All calls</h1>
        <a href={exportHref} className="text-sm text-accent hover:underline" download>
          Download as spreadsheet
        </a>
      </div>

      <form action="/calls" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6" role="search">
        <div className="col-span-2 sm:col-span-6">
          <label htmlFor="q" className="sr-only">
            Search by name, number or area
          </label>
          <input id="q" name="q" defaultValue={f.raw.q} placeholder="Search by name, number or area" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="outcome" className="mb-1 block text-sm text-muted">
            What happened
          </label>
          <select id="outcome" name="outcome" defaultValue={f.raw.outcome} className={inputClass}>
            <option value="">All</option>
            {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="hours" className="mb-1 block text-sm text-muted">
            Time of day
          </label>
          <select id="hours" name="hours" defaultValue={f.raw.hours} className={inputClass}>
            <option value="">Any time</option>
            <option value="day">Office hours</option>
            <option value="after">After hours</option>
          </select>
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="from" className="mb-1 block text-sm text-muted">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={f.raw.from} className={inputClass} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="to" className="mb-1 block text-sm text-muted">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={f.raw.to} className={inputClass} />
        </div>
        <div className="col-span-2 flex items-center gap-2 sm:col-span-6">
          <button className={buttonPrimary}>Show calls</button>
          {hasFilters && (
            <Link href="/calls" className={buttonQuiet}>
              Clear filters
            </Link>
          )}
          <span className="ml-auto text-sm text-muted" aria-live="polite">
            {rows.length} {rows.length === 1 ? "call" : "calls"}
          </span>
        </div>
      </form>

      <div className="mt-4 border-t border-text/10">
        {shown.length === 0 ? (
          <p className="py-8 text-muted">
            {hasFilters ? "No calls match these filters. Try clearing one of them." : "No calls yet. They will appear here as soon as the agent answers one."}
          </p>
        ) : (
          <CallList calls={shown} />
        )}
      </div>

      {rows.length > PAGE && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-accent hover:underline">Newer</Link> : <span />}
          <span className="text-muted">
            Page {page} of {Math.ceil(rows.length / PAGE)}
          </span>
          {page * PAGE < rows.length ? <Link href={pageHref(page + 1)} className="text-accent hover:underline">Older</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
