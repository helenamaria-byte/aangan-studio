import type { BuiltEmail } from "../emails";

export async function sendEmail(to: string | string[], email: BuiltEmail): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const missing = [!key && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean);
  if (!key || !from) throw new Error(`Email is not set up: missing ${missing.join(" and ")} in the environment variables`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { id?: string };
  return data.id ?? "";
}
