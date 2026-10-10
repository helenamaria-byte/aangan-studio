import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { markHandled, retryFailed } from "@/app/actions";
import { OutcomeBadge, buttonPrimary, buttonQuiet } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dealUrl, contactUrl } from "@/lib/clients/hubspot";
import { buildComplaintEmail, buildFrontDeskEmail, buildHandoffEmail } from "@/lib/emails";
import { formatDuration, formatInr } from "@/lib/format";
import { rowToEnquiry } from "@/lib/pipeline";
import { getCallDetail } from "@/lib/queries";
import { formatIst } from "@/lib/time";

export default async function CallDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const detail = await getCallDetail(await getDb(), id);
  if (!detail) notFound();
  const { row, view: c, bookings: bk, designers } = detail;

  const booking = bk.find((b) => b.status !== "cancelled") ?? bk[0];
  const designer = booking?.designerId ? designers.find((d) => d.id === booking.designerId) : undefined;
  const enquiry = rowToEnquiry(row);
  const repeat = Boolean((row.extractedFields as { repeatOfCallId?: number } | null)?.repeatOfCallId);

  // The note exactly as it was emailed (rebuilt from the same data and the same builder).
  let note: { title: string; text: string } | null = null;
  if (c.outcome === "qualified_booked" && booking) {
    note = {
      title: "Handoff note sent to the designer",
      text: buildHandoffEmail({
        e: enquiry,
        startsAt: booking.startsAt,
        locationType: booking.locationType === "site" || booking.locationType === "studio" ? booking.locationType : null,
        designerName: designer?.name ?? null,
        hubspotDealUrl: c.hubspotDealId ? dealUrl(c.hubspotDealId) : null,
        isRepeatCaller: repeat,
      }).text,
    };
  } else if (c.outcome === "qualified_no_booking") {
    note = { title: "Note sent to the front desk", text: buildFrontDeskEmail(enquiry, c.hubspotDealId ? dealUrl(c.hubspotDealId) : null).text };
  } else if (c.outcome === "complaint") {
    note = { title: "Alert sent to the owner", text: buildComplaintEmail(enquiry, c.hubspotContactId ? contactUrl(c.hubspotContactId) : null).text };
  }

  const raw = (row.rawPayload ?? {}) as { transcript?: unknown };
  const transcript = typeof raw.transcript === "string" ? raw.transcript : null;
  const open = c.needsAttention && !c.handledAt;

  return (
    <article>
      <Link href="/calls" className="text-sm text-accent hover:underline">
        All calls
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{c.callerName ?? c.callerPhone ?? "Unknown caller"}</h1>
          <OutcomeBadge outcome={c.outcome} />
        </div>
        <p className="mt-1 text-muted">
          {formatIst(c.startedAt)} · {formatDuration(c.durationSec)}
          {c.isAfterHours ? " · after hours" : ""}
          {c.callerPhone && c.callerName ? ` · ${c.callerPhone}` : ""}
        </p>
      </header>

      {open && (
        <div className="mt-5 rounded-lg bg-warn/10 p-4">
          <p className="text-warn">{c.errorText ?? "The designer has not received the handoff email yet"}</p>
          <div className="mt-3 flex gap-2">
            <form action={retryFailed}>
              <input type="hidden" name="id" value={c.id} />
              <button className={buttonPrimary}>Retry</button>
            </form>
            <form action={markHandled}>
              <input type="hidden" name="id" value={c.id} />
              <button className={buttonQuiet}>Mark handled</button>
            </form>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Summary</h2>
        <p className="mt-1">{c.summary ?? "No summary was captured for this call."}</p>
        {c.declineReason && <p className="mt-1 text-muted">Reason: {c.declineReason.replace(/_/g, " ")}</p>}
      </section>

      {note && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">{note.title}</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-text/[0.04] p-4 font-[inherit] text-base leading-relaxed">{note.text}</pre>
        </section>
      )}

      {booking && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Booking</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted">When</dt>
            <dd>{formatIst(booking.startsAt)} IST</dd>
            <dt className="text-muted">Where</dt>
            <dd>{booking.locationType === "site" ? "Site visit" : booking.locationType === "studio" ? "At the studio" : "Not set"}</dd>
            <dt className="text-muted">Designer</dt>
            <dd>{designer?.name ?? "Not assigned"}</dd>
            <dt className="text-muted">Status</dt>
            <dd className="capitalize">{booking.status}</dd>
          </dl>
        </section>
      )}

      {user.role === "owner" && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Cost of this call</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted">Voice</dt>
            <dd>{formatInr(c.costVoice)}</dd>
            <dt className="text-muted">Phone line</dt>
            <dd>{formatInr(c.costTelephony)}</dd>
            <dt className="text-muted">AI</dt>
            <dd>{formatInr(c.costLlm)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="font-medium">{formatInr(c.costTotal)}</dd>
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Links</h2>
        <ul className="mt-2 space-y-1 text-accent">
          {c.recordingUrl && <li><a className="hover:underline" href={c.recordingUrl} target="_blank" rel="noreferrer">Listen to the recording</a></li>}
          {c.transcriptUrl && <li><a className="hover:underline" href={c.transcriptUrl} target="_blank" rel="noreferrer">Open the transcript</a></li>}
          {c.hubspotDealId && dealUrl(c.hubspotDealId) && <li><a className="hover:underline" href={dealUrl(c.hubspotDealId)!} target="_blank" rel="noreferrer">Open the deal in HubSpot</a></li>}
          {!c.recordingUrl && !c.transcriptUrl && !c.hubspotDealId && <li className="text-muted">No links for this call.</li>}
        </ul>
      </section>

      {transcript && (
        <details className="mt-6 rounded-lg border border-text/10 p-4">
          <summary className="cursor-pointer font-medium">Full transcript</summary>
          <pre className="mt-3 whitespace-pre-wrap font-[inherit] text-base leading-relaxed">{transcript}</pre>
        </details>
      )}
    </article>
  );
}
