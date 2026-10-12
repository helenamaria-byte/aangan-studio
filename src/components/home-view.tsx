import Link from "next/link";
import { NeedsAttention } from "@/components/attention";
import { CallList } from "@/components/call-list";
import { RoomVignette } from "@/components/room-vignette";
import { PeriodToggle, SectionTitle, Stat, card } from "@/components/ui";
import { formatCount, formatInr, formatInrShort } from "@/lib/format";
import { callsHref } from "@/lib/params";
import type { AppSettings, Role } from "@/lib/settings";
import { attentionItems, designerStats, homeStats, type CallView } from "@/lib/stats";
import { istDateKey, periodRange, type Period } from "@/lib/time";

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * The home screen of the signed-in dashboard. `calls` is already limited to what this person may see:
 * everything for the owner and front desk, only their own leads for a designer.
 */
export function HomeView({
  calls,
  settings,
  period,
  role,
  now,
  designerNames,
  canAct,
}: {
  calls: CallView[];
  settings: AppSettings;
  period: Period;
  role: Role;
  now: Date;
  designerNames: Record<number, string>;
  /** False for visitors who are only looking: buttons and dropdowns are not shown. */
  canAct: boolean;
}) {
  const range = periodRange(period, now);
  const span = { from: istDateKey(range.start), to: istDateKey(now) };
  const href = (extra: Record<string, string | undefined> = {}) => callsHref({ ...span, ...extra });
  const isDesigner = role === "designer";
  const attention = attentionItems(calls, now, role);
  const periodWord = period === "today" ? "today" : period === "week" ? "this week" : "this month";

  // ---- the headline sentence and the key numbers ----
  let headline: React.ReactNode;
  let stats: React.ReactNode;

  if (isDesigner) {
    const d = designerStats(calls, period, now);
    headline =
      d.leads === 0 ? (
        <>No new leads {periodWord}. They will appear here the moment they arrive.</>
      ) : (
        <>
          {d.label} you were given <em className="text-accent">{plural(d.leads, "lead", "leads")}</em>, and{" "}
          <em className="text-accent">{plural(d.booked, "booked a consultation", "booked consultations")}</em>.
        </>
      );
    stats = (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Leads given to you" value={formatCount(d.leads)} href={href()} />
        <Stat label="Consultations booked" value={formatCount(d.booked)} href={href({ outcome: "qualified_booked" })} />
        <Stat label="Waiting to be booked" value={formatCount(d.waiting)} href={href({ outcome: "qualified_no_booking" })} />
      </div>
    );
  } else {
    const s = homeStats(calls, settings, period, now);
    const delta = s.booked - s.prevBooked;
    const vs = delta === 0 ? `Same as ${s.prevLabel}` : `${delta > 0 ? "+" : "-"}${Math.abs(delta)} vs ${s.prevLabel}`;
    headline =
      s.total === 0 ? (
        <>No calls yet {periodWord}. The agent is live and will answer the next call, day or night.</>
      ) : (
        <>
          {s.label} the agent answered{" "}
          <em className="text-accent">
            {formatCount(s.answered)} of {formatCount(s.total)} {s.total === 1 ? "call" : "calls"}
          </em>
          , including <em className="text-accent">{formatCount(s.afterHours)} after hours</em>, and booked{" "}
          <em className="text-accent">{plural(s.booked, "consultation", "consultations")}</em>.
        </>
      );
    stats = (
      <div className={`grid grid-cols-2 gap-4 ${role === "owner" ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
        <Stat label="Calls answered" value={formatCount(s.answered)} note={`${formatCount(s.afterHours)} after hours`} href={href()} />
        <Stat label="Consultations booked" value={formatCount(s.booked)} note={vs} href={href({ outcome: "qualified_booked" })} />
        {role === "owner" && (
          <>
            <Stat
              label="Est. pipeline value"
              value={formatInrShort(s.pipelineInr)}
              note={`${s.booked} × avg ${formatInrShort(settings.averageProjectValueInr)}`}
              href={href({ outcome: "qualified_booked" })}
            />
            <Stat
              label={`Cost ${periodWord}`}
              value={formatInr(s.totalCostInr)}
              note={s.costPerBookedInr === null ? undefined : `${formatInr(s.costPerBookedInr)} per booking`}
              href={href()}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="space-y-8">
        <h1 className="sr-only">{isDesigner ? "My leads" : "Home"}</h1>
        <PeriodToggle current={period} />
        <div className="grid items-center gap-8 md:grid-cols-[1fr_280px]">
          <p className="font-display text-[1.9rem] leading-[1.22] sm:text-[2.5rem]">{headline}</p>
          <div className="hidden md:block" aria-hidden>
            <RoomVignette />
          </div>
        </div>
        {stats}
      </div>

      <NeedsAttention items={attention} canAct={canAct} />

      <section aria-labelledby="latest-h">
        <SectionTitle
          id="latest-h"
          action={
            <Link href="/calls" className="text-sm text-accent hover:underline">
              See all
            </Link>
          }
        >
          {isDesigner ? "Your latest leads" : "Latest calls"}
        </SectionTitle>
        {calls.length === 0 ? (
          <p className={`${card} mt-4 px-5 py-4 text-muted`}>{isDesigner ? "Nothing here yet. New leads appear as they arrive." : "No calls yet. The first one will show up here."}</p>
        ) : (
          <div className={`${card} mt-4 px-5`}>
            <CallList calls={calls.slice(0, 8)} canEdit={canAct} designerNames={isDesigner ? undefined : designerNames} />
          </div>
        )}
      </section>
    </div>
  );
}
