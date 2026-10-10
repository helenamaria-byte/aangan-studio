import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Vaani: accepts either a shared secret sent as a header, or an HMAC-SHA256 hex signature of the raw body.
 * TODO: confirm which one Vaani actually uses (header names below are the common ones) and drop the other.
 */
export function verifyVaani(rawBody: string, headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false; // fail closed: an unset secret must never mean "accept everything"
  const shared = headers.get("x-vaani-secret") ?? headers.get("x-webhook-secret");
  if (shared) return safeEqual(shared, secret);
  const sig = headers.get("x-vaani-signature") ?? headers.get("x-signature");
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(sig.replace(/^sha256=/, ""), expected);
}

/** Cal.com signs the raw body with HMAC-SHA256 (hex) in the x-cal-signature-256 header. */
export function verifyCalcom(rawBody: string, headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const sig = headers.get("x-cal-signature-256");
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(sig, expected);
}

/** Vercel cron sends "Authorization: Bearer <CRON_SECRET>". */
export function verifyCron(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  return safeEqual(headers.get("authorization") ?? "", `Bearer ${secret}`);
}
