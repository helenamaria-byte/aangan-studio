import { toE164 } from "../phone";

// HubSpot private-app token. Needs scopes: crm.objects.contacts (read/write), crm.objects.deals (read/write).
// Custom contact property `aangan_decline_reason` (single-line text) must exist. See README.

const BASE = "https://api.hubapi.com";

async function hs<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? ({} as T) : ((await res.json()) as T));
}

export interface ContactInput {
  name: string | null;
  phone: string | null;
  locality: string | null;
  declineReason?: string | null;
}

function contactProps(c: ContactInput) {
  const [first, ...rest] = (c.name ?? "").split(" ");
  const props: Record<string, string> = {};
  if (first) props.firstname = first;
  if (rest.length) props.lastname = rest.join(" ");
  const phone = toE164(c.phone);
  if (phone) props.phone = phone;
  if (c.locality) props.city = c.locality;
  if (c.declineReason) props.aangan_decline_reason = c.declineReason;
  return props;
}

const isMissingProperty = (err: unknown) =>
  err instanceof Error && /aangan_decline_reason|PROPERTY_DOESNT_EXIST/i.test(err.message);

/**
 * One contact per phone number: search first, create only if none.
 * If the custom decline-reason property has not been created in HubSpot yet, the contact is saved without it
 * (the reason is also written as a note by the caller), so a missing property never loses a lead.
 */
export async function upsertContact(c: ContactInput, knownContactId?: string | null): Promise<string> {
  // HubSpot's search is eventually consistent: a contact created seconds ago may not be found yet.
  // If our own records already know this caller's contact, update it directly and never search.
  if (knownContactId) {
    const patch = (withReason: boolean) =>
      hs(`/crm/v3/objects/contacts/${knownContactId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: contactProps(withReason ? c : { ...c, declineReason: null }) }),
      });
    try {
      try {
        await patch(true);
      } catch (err) {
        if (c.declineReason && isMissingProperty(err)) await patch(false);
        else throw err;
      }
      return knownContactId;
    } catch (err) {
      // The contact was deleted or merged in HubSpot: fall through to search or create.
      if (!(err instanceof Error && /HubSpot 404/.test(err.message))) throw err;
    }
  }
  try {
    return await upsertContactOnce(c);
  } catch (err) {
    if (c.declineReason && isMissingProperty(err)) return upsertContactOnce({ ...c, declineReason: null });
    throw err;
  }
}

async function upsertContactOnce(c: ContactInput): Promise<string> {
  const phone = toE164(c.phone);
  if (phone) {
    const found = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: phone }] }],
        limit: 1,
      }),
    });
    const existing = found.results[0];
    if (existing) {
      await hs(`/crm/v3/objects/contacts/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: contactProps(c) }),
      });
      return existing.id;
    }
  }
  const created = await hs<{ id: string }>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: contactProps(c) }),
  });
  return created.id;
}

export async function findContactByPhone(rawPhone: string | null): Promise<string | null> {
  const phone = toE164(rawPhone);
  if (!phone) return null;
  const found = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: phone }] }],
      limit: 1,
    }),
  });
  return found.results[0]?.id ?? null;
}

/**
 * HubSpot's default deal pipeline already has these internal stage IDs. Their labels can be renamed in HubSpot
 * (Settings > Objects > Deals > Pipelines) without changing the IDs, so no custom stages are needed:
 *   appointmentscheduled -> rename to "New lead"
 *   qualifiedtobuy       -> rename to "Consultation booked"
 *   closedlost           -> used when a booking is cancelled
 * Set HUBSPOT_STAGE_* to use other stages.
 */
const DEFAULT_STAGES = { new: "appointmentscheduled", booked: "qualifiedtobuy", cancelled: "closedlost" } as const;

export function stageId(stage: "booked" | "new" | "cancelled"): string {
  const env = {
    booked: process.env.HUBSPOT_STAGE_BOOKED,
    new: process.env.HUBSPOT_STAGE_NEW,
    cancelled: process.env.HUBSPOT_STAGE_CANCELLED,
  }[stage];
  return env || DEFAULT_STAGES[stage];
}

export async function createDeal(contactId: string, dealName: string, stage: "booked" | "new"): Promise<string> {
  const deal = await hs<{ id: string }>("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: dealName,
        pipeline: process.env.HUBSPOT_PIPELINE_ID ?? "default",
        dealstage: stageId(stage),
      },
      associations: [
        {
          to: { id: contactId },
          // 3 = deal-to-contact association type in HubSpot's default (HUBSPOT_DEFINED) category.
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ],
    }),
  });
  return deal.id;
}

export async function setDealStage(dealId: string, stage: "booked" | "new" | "cancelled"): Promise<void> {
  await hs(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { dealstage: stageId(stage) } }),
  });
}

export async function addNote(objectType: "contacts" | "deals", objectId: string, body: string): Promise<void> {
  await hs("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: { hs_note_body: body, hs_timestamp: new Date().toISOString() },
      associations: [
        {
          to: { id: objectId },
          // 202 = note-to-contact, 214 = note-to-deal.
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: objectType === "contacts" ? 202 : 214 }],
        },
      ],
    }),
  });
}

export const dealUrl = (dealId: string) =>
  process.env.HUBSPOT_PORTAL_ID ? `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/deal/${dealId}` : null;

export const contactUrl = (contactId: string) =>
  process.env.HUBSPOT_PORTAL_ID ? `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/contact/${contactId}` : null;
