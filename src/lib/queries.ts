import { desc, eq } from "drizzle-orm";
import { bookings, calls, designers } from "@/db/schema";
import type { Db } from "./settings";
import { toCallView, type CallView } from "./stats";

// One month is about 200 calls, so loading a year and filtering in memory is simple, fast, and easy to test.
const MAX_ROWS = 5000;

export async function getAllCalls(db: Db): Promise<CallView[]> {
  const rows = await db.select().from(calls).orderBy(desc(calls.startedAt)).limit(MAX_ROWS);
  return rows.map(toCallView);
}

export async function getCallDetail(db: Db, id: number) {
  const [row] = await db.select().from(calls).where(eq(calls.id, id));
  if (!row) return null;
  const callBookings = await db.select().from(bookings).where(eq(bookings.callId, id));
  const designerRows = await db.select().from(designers);
  return { row, view: toCallView(row), bookings: callBookings, designers: designerRows };
}

export const getBookings = (db: Db) => db.select().from(bookings);
export const getDesigners = (db: Db) => db.select().from(designers).orderBy(designers.name);
