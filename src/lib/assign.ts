import { eq, inArray } from "drizzle-orm";
import { calls, designers } from "@/db/schema";
import type { Db } from "./settings";

// Every new lead is given to one designer automatically: whoever has the fewest leads so far.
// Ties go to the designer who joined first, so the order is stable and fair.

export const LEAD_OUTCOMES = ["qualified_booked", "qualified_no_booking"] as const;

export interface DesignerLoad {
  id: number;
  active: boolean;
  leads: number;
}

/** The designer who should get the next lead, or null if nobody is available. Pure, so it is easy to test. */
export function pickDesigner(loads: DesignerLoad[]): number | null {
  const available = loads.filter((d) => d.active);
  if (!available.length) return null;
  return [...available].sort((a, b) => a.leads - b.leads || a.id - b.id)[0].id;
}

export async function designerLoads(db: Db): Promise<DesignerLoad[]> {
  const all = await db.select().from(designers);
  const assigned = await db
    .select({ designerId: calls.assignedDesignerId })
    .from(calls)
    .where(inArray(calls.outcome, [...LEAD_OUTCOMES]));
  const counts = new Map<number, number>();
  for (const a of assigned) if (a.designerId) counts.set(a.designerId, (counts.get(a.designerId) ?? 0) + 1);
  return all.map((d) => ({ id: d.id, active: d.active, leads: counts.get(d.id) ?? 0 }));
}

/** Gives a lead to a designer, once. A lead that already has a designer keeps them. Returns the designer's id. */
export async function assignDesigner(db: Db, callId: number): Promise<number | null> {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!call) return null;
  if (call.assignedDesignerId) return call.assignedDesignerId;
  if (!call.outcome || !(LEAD_OUTCOMES as readonly string[]).includes(call.outcome)) return null;

  const id = pickDesigner(await designerLoads(db));
  if (id === null) return null;
  await db.update(calls).set({ assignedDesignerId: id }).where(eq(calls.id, callId));
  return id;
}
