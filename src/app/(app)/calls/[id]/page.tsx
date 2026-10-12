import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { markHandled, retryFailed } from "@/app/actions";
import { displayName } from "@/components/call-list";
import { DesignerSelect } from "@/components/designer-select";
import { StatusSelect } from "@/components/status-select";
import { OutcomeBadge, SectionTitle, buttonPrimary, buttonQuiet, card } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { dealUrl } from "@/lib/clients/hubspot";
import { formatDuration, formatInr } from "@/lib/format";
import { getCallDetail, getDesigners } from "@/lib/queries";
import { formatIst } from "@/lib/time";

const DECISION: Record<string, string> = {
  yes: "The caller decides",
  represented: "Calling for the person who decides. Ask them to come to the consultation",
  unclear: "To be confirmed at the consultation",
};

/** One labelled line. Nothing is rendered when there is nothing to show, so a missing detail never appears. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === false || children === "") return null;
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function CallDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const detail = await getCallDetail(db, id);
  if (!detail) notFound();
  const { row, view: c, bookings: bk, designers } = detail;
  // A designer opens only the leads given to them.
  if (viewer.scopeDesignerId !== null && c.assignedDesignerId !== viewer.scopeDesignerId) notFound();

  const f = (row.extractedFields ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof f[k] === "string" && (f[k] as string).trim() ? (f[k] as string).trim() : null);
  const size = typeof f.sizeSqft === "number" ? f.sizeSqft : null;

  const booking = bk.find((b) => b.status !== "cancelled") ?? bk[0];
  const assigned = designers.find((d) => d.id === c.assignedDesignerId);
  const bookedWith = booking?.designerId ? designers.find((d) => d.id === booking.designerId) : undefined;
  const allDesigners = (await getDesigners(db)).filter((d) => d.active);

  const canEdit = !viewer.anonymous;
  const isOwner = viewer.role === "owner" && !viewer.anonymous;
  const canReassign = canEdit && viewer.role !== "designer";
  const attention = c.needsAttention && !c.handledAt;

  const property = [text("propertyType"), size ? `${size.toLocaleString("en-IN")} sq ft` : null].filter(Boolean).join(", ");
  const raw = (row.rawPayload ?? {}) as { transcript?: unknown };
  const transcript = typeof raw.transcript === "string" ? raw.transcript : null;
  const links = [
    c.recordingUrl && { href: c.recordingUrl, label: "Listen to the recording" },
    c.transcriptUrl && { href: c.transcriptUrl, label: "Open the transcript" },
    c.hubspotDealId && dealUrl(c.hubspotDealId) && { href: dealUrl(c.hubspotDealId)!, label: "Open in HubSpot" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <article className="space-y-10">
      <div>
        <Link href="/calls" className="text-sm text-accent hover:underline">
          ← All calls
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <h1 className="text-[2.4rem] font-medium leading-tight">{displayName(c)}</h1>
            <p className="mt-1 text-muted">
              {formatIst(c.startedAt)}
              {c.durationSec ? ` · ${formatDuration(c.durationSec)}` : ""}
              {c.isAfterHours ? " · after hours" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? <StatusSelect id={c.id} outcome={c.outcome} /> : <OutcomeBadge outcome={c.outcome} />}
          </div>
        </header>

        <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-muted">Designer</dt>
            <dd>
              {canReassign ? <DesignerSelect id={c.id} current={c.assignedDesignerId} designers={allDesigners} /> : (assigned?.name ?? "Not given yet")}
            </dd>
          </div>
        </dl>
      </div>

      {attention && canEdit && viewer.role !== "designer" && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
          <p>{c.outcome === "complaint" ? "A complaint from an existing client. Please follow up." : "This is waiting for someone to follow up."}</p>
          <form action={markHandled}>
            <input type="hidden" name="id" value={c.id} />
            <button className={buttonPrimary}>Mark handled</button>
          </form>
        </div>
      )}

      {c.summary && (
        <section>
          <SectionTitle>Summary</SectionTitle>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed">{c.summary}</p>
        </section>
      )}

      <section>
        <SectionTitle>Brief</SectionTitle>
        <dl className={`${card} mt-4 divide-y divide-text/10 px-5`}>
          <Line label="Phone">{c.callerPhone && <a className="text-accent hover:underline" href={`tel:${c.callerPhone.replace(/\s/g, "")}`}>{c.callerPhone}</a>}</Line>
          <Line label="Where">{text("locality")}</Line>
          <Line label="Property">{property}</Line>
          <Line label="What they want">{text("scopeSummary")}</Line>
          <Line label="Timeline">{text("timelineText")}</Line>
          <Line label="Decision-maker">{typeof f.decisionMaker === "string" ? DECISION[f.decisionMaker] : null}</Line>
          <Line label="Budget they mentioned">{text("budgetMentioned")}</Line>
          <Line label="To check">{text("doubts")}</Line>
          <Line label="Language">{text("language")}</Line>
        </dl>
      </section>

      {booking && (
        <section>
          <SectionTitle>Consultation</SectionTitle>
          <dl className={`${card} mt-4 divide-y divide-text/10 px-5`}>
            <Line label="When">{formatIst(booking.startsAt)} IST</Line>
            <Line label="Where">{booking.locationType === "site" ? "Site visit" : booking.locationType === "studio" ? "At the studio" : null}</Line>
            <Line label="Booked with">{bookedWith?.name}</Line>
            <Line label="Status">
              <span className="capitalize">{booking.status}</span>
            </Line>
          </dl>
        </section>
      )}

      {links.length > 0 && (
        <section>
          <SectionTitle>Links</SectionTitle>
          <ul className="mt-3 space-y-1 text-accent">
            {links.map((l) => (
              <li key={l.href}>
                <a className="hover:underline" href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && c.costTotal > 0 && (
        <section>
          <SectionTitle>Cost of this call</SectionTitle>
          <p className="mt-3">{formatInr(c.costTotal)}</p>
        </section>
      )}

      {transcript && (
        <details className={`${card} px-5 py-4`}>
          <summary className="cursor-pointer font-medium">Full transcript</summary>
          <pre className="mt-3 whitespace-pre-wrap font-[inherit] text-base leading-relaxed">{transcript}</pre>
        </details>
      )}

      {isOwner && c.errorText && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-2">{c.errorText}</p>
          <form action={retryFailed} className="mt-3">
            <input type="hidden" name="id" value={c.id} />
            <button className={buttonQuiet}>Try again</button>
          </form>
        </details>
      )}
    </article>
  );
}
