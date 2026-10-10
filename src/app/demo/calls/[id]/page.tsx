import Link from "next/link";
import { notFound } from "next/navigation";
import { OutcomeBadge } from "@/components/ui";
import { getDemoData } from "@/lib/demo-data";
import { buildComplaintEmail, buildFrontDeskEmail, buildHandoffEmail } from "@/lib/emails";
import { formatDuration, formatInr } from "@/lib/format";
import { rowToEnquiry } from "@/lib/pipeline";
import { formatIst } from "@/lib/time";

export default async function DemoCallDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = getDemoData();
  const row = d.rows.find((r) => r.id === id);
  const c = d.calls.find((x) => x.id === id);
  if (!row || !c) notFound();

  const booking = d.bookings.find((b) => b.callId === id && b.status !== "cancelled");
  const designer = booking ? d.designers.find((x) => x.id === booking.designerId) : undefined;
  const e = rowToEnquiry(row);

  let note: { title: string; text: string } | null = null;
  if (c.outcome === "qualified_booked" && booking) {
    note = {
      title: "Handoff note sent to the designer",
      text: buildHandoffEmail({
        e,
        startsAt: booking.startsAt,
        locationType: booking.locationType === "site" || booking.locationType === "studio" ? booking.locationType : null,
        designerName: designer?.name ?? null,
        hubspotDealUrl: null,
        isRepeatCaller: false,
      }).text,
    };
  } else if (c.outcome === "qualified_no_booking") {
    note = { title: "Note sent to the front desk", text: buildFrontDeskEmail(e, null).text };
  } else if (c.outcome === "complaint") {
    note = { title: "Alert sent to the owner", text: buildComplaintEmail(e, null).text };
  }

  return (
    <article>
      <Link href="/demo/calls" className="text-sm text-accent hover:underline">
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
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Summary</h2>
        <p className="mt-1">{c.summary ?? "No summary was captured for this call."}</p>
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
            <dt className="text-muted">Designer</dt>
            <dd>{designer?.name ?? "Not assigned"}</dd>
            <dt className="text-muted">Status</dt>
            <dd className="capitalize">{booking.status}</dd>
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Cost of this call</h2>
        <p className="mt-1">{formatInr(c.costTotal)}</p>
      </section>
    </article>
  );
}
