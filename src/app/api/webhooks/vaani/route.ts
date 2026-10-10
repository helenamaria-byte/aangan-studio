import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { ingestVaaniCall } from "@/lib/pipeline";
import { shouldProcessEvent } from "@/lib/sources/vaani";
import { verifyVaani } from "@/lib/verify";

export const maxDuration = 60;

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyVaani(rawBody, req.headers, process.env.VAANI_WEBHOOK_SECRET, new URL(req.url).searchParams.get("token"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  // Vaani sends an event for every stage of a call. Only the final one (call_postprocessing) is the call record.
  if (!shouldProcessEvent(payload)) return NextResponse.json({ ok: true, ignored: true });

  // Respond fast; the slow work (HubSpot, email) runs after the response is sent.
  after(async () => {
    try {
      await ingestVaaniCall(await getDb(), payload);
    } catch (err) {
      // Last resort: the raw payload is still in Vaani's own logs. This line is what shows in Vercel logs.
      console.error("Vaani webhook processing failed", err);
    }
  });
  return NextResponse.json({ ok: true });
}
