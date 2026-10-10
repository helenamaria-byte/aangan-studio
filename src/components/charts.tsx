// Simple, calm charts built from plain HTML so they stay sharp and responsive on a phone.
// Rules followed: one axis, thin marks with a 2px gap between fills, a legend whenever there are two or more
// series, text in ink colours (never the series colour), and a table view for every chart.

export const CHART = {
  teal: "#0E8A6B", // main series
  clay: "#C2693A", // second series
  indigo: "#6B6FB5", // third series
};

export interface Series {
  name: string;
  color: string;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label="Legend">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({
  title,
  takeaway,
  series,
  children,
  table,
}: {
  title: string;
  takeaway: string;
  series?: Series[];
  children: React.ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
}) {
  return (
    <section className="border-t border-text/10 py-8" aria-labelledby={`h-${title.replace(/\W+/g, "-")}`}>
      <h2 id={`h-${title.replace(/\W+/g, "-")}`} className="font-ui text-sm text-muted">
        {title}
      </h2>
      <p className="mt-1 text-xl leading-snug">{takeaway}</p>
      {series && (
        <div className="mt-4">
          <Legend series={series} />
        </div>
      )}
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-accent">Show as a table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-muted">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} className="py-1 pr-4 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-text/10">
                    {r.map((cell, j) => (
                      <td key={j} className="py-1 pr-4">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export interface Column {
  label: string; // shown under the bar
  tooltip: string;
  values: number[]; // one per series, stacked bottom to top
}

/** Stacked vertical columns, one axis, gridlines at 0, half and the maximum. */
export function StackedColumns({
  data,
  series,
  ariaLabel,
  formatValue = (n) => String(n),
  labelEvery = 1,
}: {
  data: Column[];
  series: Series[];
  ariaLabel: string;
  formatValue?: (n: number) => string;
  labelEvery?: number;
}) {
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals);
  const H = 150;

  return (
    <div role="img" aria-label={ariaLabel} className="flex gap-2">
      <div className="relative w-9 shrink-0 text-right text-xs text-muted" style={{ height: H }} aria-hidden>
        <span className="absolute right-0 top-0 -translate-y-1/2">{formatValue(max)}</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatValue(max / 2)}</span>
        <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: H }}>
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-text/10" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-text/10" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-text/25" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div key={i} title={d.tooltip} className="flex h-full min-w-0 flex-1 flex-col-reverse gap-[2px]">
                {d.values.map((v, s) =>
                  v > 0 ? (
                    <div
                      key={s}
                      className="w-full rounded-t-[3px]"
                      style={{ height: `${(v / max) * 100}%`, background: series[s].color, minHeight: 2 }}
                    />
                  ) : null,
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex gap-[2px] text-xs text-muted" aria-hidden>
          {data.map((d, i) => (
            <div key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % labelEvery === 0 ? d.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  display?: string;
}

/** Horizontal bars with the value written at the end of each bar (direct labels, no axis needed). */
export function BarList({ rows, color = CHART.teal, ariaLabel }: { rows: BarRow[]; color?: string; ariaLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul role="img" aria-label={ariaLabel} className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-4 text-base">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 font-medium">{r.display ?? r.value}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-r-[4px] bg-text/[0.05]" aria-hidden>
            <div className="h-full rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, background: color, minWidth: r.value > 0 ? 3 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
