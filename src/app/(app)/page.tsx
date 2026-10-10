import Link from "next/link";
import { getDb } from "@/db";
import { NeedsAttention } from "@/components/attention";
import { CallList } from "@/components/call-list";
import { PeriodToggle, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatCount, formatInr, formatInrShort } from "@/lib/format";
import { callsHref } from "@/lib/params";
import { getAllCalls } from "@/lib/queries";
import { loadSettings } from "@/lib/settings";
import { attentionItems, homeStats } from "@/lib/stats";
import { istDateKey, parsePeriod, periodRange } from "@/lib/time";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const period = parsePeriod((await searchParams).period);
  const now = new Date();

  const db = await getDb();
  const [calls, settings] = await Promise.all([getAllCalls(db), loadSettings(db)]);
  const s = homeStats(calls, settings, period, now);
  const range = periodRange(period, now);
  const from = istDateKey(range.start);
  const to = istDateKey(now);
  const range_ = { from, to };
  const showMoney = user.role === "owner";

  const delta = s.booked - s.prevBooked;
  const bookedNote = `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${Math.abs(delta)} vs ${s.prevLabel}`.replace(/^0 vs/, "Same as");
  const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
  const answeredPct = s.total ? Math.round((s.answered / s.total) * 100) : 100;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="sr-only">Home</h1>
        <PeriodToggle current={period} />
      </div>

      <section aria-label="Summary" className="mt-6">
        {s.total === 0 ? (
          <p className="text-2xl leading-snug">
            No calls yet {period === "today" ? "today" : period === "week" ? "this week" : "this month"}.{" "}
            <span className="text-muted">
              The agent is live{settings.studioPhone ? ` on ${settings.studioPhone}` : ""} and will answer the next call, day or night.
            </span>
          </p>
        ) : (
          <p className="text-2xl leading-snug">
            {s.label} the agent answered{" "}
            <span className="font-medium">
              {formatCount(s.answered)} of {formatCount(s.total)} {s.total === 1 ? "call" : "calls"}
            </span>
            , including <span className="font-medium">{formatCount(s.afterHours)} after hours</span>, and booked{" "}
            <span className="font-medium">{plural(s.booked, "consultation", "consultations")}</span>.
          </p>
        )}
      </section>

      <section aria-label="Key numbers" className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Stat
          label="Calls answered"
          value={formatCount(s.answered)}
          note={`${answeredPct}% answered · ${formatCount(s.afterHours)} after hours`}
          href={callsHref(range_)}
        />
        <Stat
          label="Consultations booked"
          value={formatCount(s.booked)}
          note={bookedNote}
          href={callsHref({ ...range_, outcome: "qualified_booked" })}
        />
        {showMoney && (
          <>
            <Stat
              label="Est. pipeline value"
              value={formatInrShort(s.pipelineInr)}
              note={`${s.booked} bookings × avg ${formatInrShort(settings.averageProjectValueInr)} (estimate)`}
              href={callsHref({ ...range_, outcome: "qualified_booked" })}
            />
            <Stat
              label={`Cost ${s.label.toLowerCase()}`}
              value={formatInr(s.totalCostInr)}
              note={s.costPerBookedInr === null ? "No bookings yet" : `${formatInr(s.costPerBookedInr)} per booked consultation`}
              href={callsHref(range_)}
            />
          </>
        )}
      </section>

      <div className="mt-4 border-t border-text/10">
        <NeedsAttention items={attentionItems(calls, now)} />
      </div>

      <section aria-labelledby="latest-h" className="border-t border-text/10 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 id="latest-h" className="text-lg font-medium">
            Latest calls
          </h2>
          <Link href="/calls" className="text-sm text-accent hover:underline">
            See all calls
          </Link>
        </div>
        {calls.length === 0 ? (
          <p className="mt-3 text-muted">
            No calls yet. The agent is live{settings.studioPhone ? ` on ${settings.studioPhone}` : ""}. The first call will show up here.
          </p>
        ) : (
          <div className="mt-2">
            <CallList calls={calls.slice(0, 8)} />
          </div>
        )}
      </section>
    </div>
  );
}
