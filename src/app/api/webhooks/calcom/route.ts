import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { ingestCalcom, parseCalcom } from "@/lib/calcom";
import { verifyCalcom } from "@/lib/verify";

export const maxDuration = 60;

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyCalcom(rawBody, req.headers, process.env.CALCOM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = parseCalcom(JSON.parse(rawBody));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bad payload" }, { status: 400 });
  }
  if (!parsed) return NextResponse.json({ ok: true, ignored: true });

  after(async () => {
    try {
      await ingestCalcom(await getDb(), parsed);
    } catch (err) {
      console.error("Cal.com webhook processing failed", err);
    }
  });
  return NextResponse.json({ ok: true });
}
