import { BarList, CHART, ChartCard, StackedColumns } from "@/components/charts";
import { formatCount, formatInr, formatInrShort } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";
import { istDateKey } from "@/lib/time";
import { type BookingRow, type CallView, afterHoursShare, bookingsByDesigner, callsPerDay, costByMonth, declineReasons, funnel, medianMinutesToDesigner } from "@/lib/stats";

const MANUAL_BASELINE = "48% of enquiries got no reply within 48 hours";

function minutes(m: number): string {
  if (m < 1) return "under a minute";
  if (m < 60) return `${Math.round(m)} ${Math.round(m) === 1 ? "minute" : "minutes"}`;
  return `${(m / 60).toFixed(1).replace(/\.0$/, "")} hours`;
}

/** The six charts of the signed-in dashboard. */
export function ReportsView({
  all,
  bookingRows,
  designerRows,
  settings,
  now,
}: {
  all: CallView[];
  bookingRows: BookingRow[];
  designerRows: { id: number; name: string }[];
  settings: AppSettings;
  now: Date;
}) {
  // One window for every section, so the numbers agree: the last 30 IST calendar days, including today.
  const days = callsPerDay(all, now, 30);
  const windowDays = new Set(days.map((d) => d.key));
  const last30 = all.filter((c) => windowDays.has(istDateKey(c.startedAt)));
  const ids = new Set(last30.map((c) => c.id));

  // 1. Calls per day
  const ah = afterHoursShare(days);
  const dayLabel = (k: string) => {
    const [, m, d] = k.split("-");
    return `${Number(d)}/${Number(m)}`;
  };

  // 2. Funnel
  const f = funnel(last30, bookingRows.filter((b) => b.callId && ids.has(b.callId)));

  // 3. Decline reasons
  const declines = declineReasons(last30);
  const declinedTotal = declines.reduce((a, d) => a + d.count, 0);

  // 4. Before vs after
  const median = medianMinutesToDesigner(last30);

  // 5. Cost by month
  const months = costByMonth(all, settings, now, 6);
  const latest = months[months.length - 1];
  const costSeries = [
    { name: "Voice and phone line", color: CHART.teal },
    { name: "AI", color: CHART.clay },
    { name: "Software plans", color: CHART.indigo },
  ];

  // 6. Designers
  const designers = bookingsByDesigner(bookingRows.filter((b) => !b.startsAt || now.getTime() - b.startsAt.getTime() < 60 * 86_400_000), designerRows);
  const spread = designers.length > 1 ? designers[0].count - designers[designers.length - 1].count : 0;

  return (
    <div>
      <h1 className="text-2xl font-medium">Reports</h1>
      <p className="mt-1 text-muted">The last 30 days unless it says otherwise. Hover or tap a bar for the exact figure.</p>

      <ChartCard
        title="Calls per day"
        takeaway={
          ah.total === 0
            ? "No calls in the last 30 days yet."
            : `${Math.round(ah.share * 100)}% of calls came after hours (${formatCount(ah.after)} of ${formatCount(ah.total)}). These would have been missed before.`
        }
        series={[
          { name: "Office hours", color: CHART.teal },
          { name: "After hours", color: CHART.clay },
        ]}
        table={{ head: ["Day", "Office hours", "After hours"], rows: days.map((d) => [dayLabel(d.key), d.office, d.after]) }}
      >
        <StackedColumns
          ariaLabel="Calls per day for the last 30 days, split into office hours and after hours"
          series={[
            { name: "Office hours", color: CHART.teal },
            { name: "After hours", color: CHART.clay },
          ]}
          data={days.map((d) => ({
            label: dayLabel(d.key),
            values: [d.office, d.after],
            tooltip: `${dayLabel(d.key)}: ${d.office + d.after} calls (${d.office} in office hours, ${d.after} after hours)`,
          }))}
          labelEvery={5}
        />
      </ChartCard>

      <ChartCard
        title="What happened to calls"
        takeaway={`Of ${formatCount(f.answered)} calls, ${formatCount(f.qualified)} were worth a designer's time and ${formatCount(f.booked)} booked a consultation. ${formatCount(f.held)} consultations have been held so far.`}
        table={{ head: ["Step", "Calls"], rows: [["Answered", f.answered], ["Qualified", f.qualified], ["Booked", f.booked], ["Consultation held", f.held]] }}
      >
        <BarList
          ariaLabel="Funnel from answered calls to consultations held"
          rows={[
            { label: "Answered", value: f.answered },
            { label: "Qualified", value: f.qualified },
            { label: "Booked", value: f.booked },
            { label: "Consultation held", value: f.held },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Why callers were declined"
        takeaway={
          declines.length
            ? `The most common reason was "${declines[0].label.toLowerCase()}" (${declines[0].count} of ${declinedTotal} declined calls).`
            : "No calls were declined in the last 30 days."
        }
        table={{ head: ["Reason", "Calls"], rows: declines.map((d) => [d.label, d.count]) }}
      >
        <BarList ariaLabel="Declined calls by reason" rows={declines.map((d) => ({ label: d.label, value: d.count }))} />
      </ChartCard>

      <ChartCard
        title="Before and after the agent"
        takeaway={
          median === null
            ? "No booked consultations yet, so there is no response time to show."
            : `Designers now get a complete note a median of ${minutes(median)} after the call ends.`
        }
        table={{ head: ["", "Result"], rows: [["Before (manual, last month)", MANUAL_BASELINE], ["Now (median, call to designer email)", median === null ? "No data yet" : minutes(median)]] }}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-muted">Before, done by hand</div>
            <div className="mt-1 text-3xl font-medium">48%</div>
            <div className="text-sm text-muted">got no reply within 48 hours</div>
          </div>
          <div>
            <div className="text-sm text-muted">Now, with the agent</div>
            <div className="mt-1 text-3xl font-medium" style={{ color: CHART.teal }}>
              {median === null ? "-" : minutes(median)}
            </div>
            <div className="text-sm text-muted">from the call to the designer's email</div>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title="Cost by month"
        takeaway={
          latest.perBooked === null
            ? "No bookings this month yet, so there is no cost per consultation."
            : `${latest.label} cost ${formatInrShort(latest.total)} in total, about ${formatInr(latest.perBooked)} for each booked consultation.`
        }
        series={costSeries}
        table={{
          head: ["Month", "Voice and phone", "AI", "Software", "Total", "Booked", "Per booked"],
          rows: months.map((m) => [m.label, formatInr(m.phone), formatInr(m.ai), formatInr(m.software), formatInr(m.total), m.booked, m.perBooked === null ? "-" : formatInr(m.perBooked)]),
        }}
      >
        <StackedColumns
          ariaLabel="Monthly cost split into voice and phone, AI, and software plans"
          series={costSeries}
          formatValue={(n) => formatInrShort(n)}
          data={months.map((m) => ({
            label: m.label,
            values: [m.phone, m.ai, m.software],
            tooltip: `${m.label}: ${formatInr(m.total)} (voice and phone ${formatInr(m.phone)}, AI ${formatInr(m.ai)}, software ${formatInr(m.software)})`,
          }))}
        />
        <h3 className="mt-6 text-sm text-muted">Cost per booked consultation</h3>
        <div className="mt-3">
          <BarList
            ariaLabel="Cost per booked consultation by month"
            color={CHART.teal}
            rows={months.map((m) => ({ label: m.label, value: m.perBooked ?? 0, display: m.perBooked === null ? "No bookings" : formatInr(m.perBooked) }))}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Bookings by designer (last 60 days)"
        takeaway={
          designers.length < 2
            ? "Not enough bookings to compare designers yet."
            : spread <= 2
              ? "Bookings are spread evenly across designers."
              : `${designers[0].name} has the most bookings (${designers[0].count}) and ${designers[designers.length - 1].name} the fewest (${designers[designers.length - 1].count}).`
        }
        table={{ head: ["Designer", "Bookings"], rows: designers.map((d) => [d.name, d.count]) }}
      >
        <BarList ariaLabel="Bookings per designer" rows={designers.map((d) => ({ label: d.name, value: d.count }))} />
      </ChartCard>
    </div>
  );
}
