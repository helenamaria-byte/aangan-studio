/** Last 10 digits, used to match the same person across Vaani, Cal.com and HubSpot. */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** E.164 for Indian numbers: +91XXXXXXXXXX. Returns null if it does not look like a phone number. */
export function toE164(raw: string | null | undefined): string | null {
  const key = phoneKey(raw);
  return key ? `+91${key}` : null;
}
