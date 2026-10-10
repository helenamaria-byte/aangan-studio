import type { Enquiry } from "./enquiry";

// EXTRACTION_MODE=llm: fill the structured fields from the transcript instead of trusting Vaani's own analysis.
// Only used if Vaani's extraction proves unreliable in testing. The cost of this call is added to cost_llm_inr.

const FIELDS_PROMPT = `You read a phone call transcript from an interior design studio's front desk and return JSON only.
Keys: caller_name, caller_phone, locality, property_type (apartment|house|villa|office|clinic|other), size_sqft (number),
scope_summary, timeline_text, decision_maker (yes|represented|unclear), budget_mentioned (text, only if the caller said a figure, else null),
outcome (qualified_booked|qualified_no_booking|declined|complaint|dropped|spam_or_wrong_number),
decline_reason (advice_only|out_of_area|timeline|budget|out_of_scope_type|too_small|other|null), doubts, language, summary (max 3 sentences).
Use null for anything not said. An existing client with a problem is always "complaint". Never invent values.`;

export async function extractWithLlm(
  transcript: string,
  base: Enquiry,
  usdToInr: number,
): Promise<Enquiry> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("EXTRACTION_MODE=llm needs ANTHROPIC_API_KEY");
  const model = process.env.EXTRACTION_MODEL ?? "claude-haiku-5-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: FIELDS_PROMPT,
      messages: [{ role: "user", content: transcript.slice(0, 40_000) }],
    }),
  });
  if (!res.ok) throw new Error(`LLM extraction ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;

  // Re-use the Vaani adapter's validation by feeding it a synthetic payload.
  const { parseVaaniPayload } = await import("./sources/vaani");
  const raw = base.raw as Record<string, unknown>;
  const reparsed = parseVaaniPayload({ ...raw, analysis: json }, { usdToInr });

  // TODO: price the call properly once the model's per-token rate is in settings. Zero until then, and flagged.
  return { ...reparsed, costs: { ...base.costs, llmInr: base.costs.llmInr } };
}
