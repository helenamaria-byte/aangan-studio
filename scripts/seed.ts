// Fills the database with a month of realistic demo data. Safe to run again: it replaces earlier demo rows only.
// Run: npm run seed        (uses DATABASE_URL from .env.local)
import { like } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { bookings, calls, designers, settings } from "../src/db/schema";
import { generateSeed } from "../src/lib/seed-data";

async function main() {
  const db = await getDb();
  const seed = generateSeed(new Date());

  // Remove earlier demo rows (never touches real calls: demo IDs all start with "seed-").
  await db.delete(bookings).where(like(bookings.calcomBookingId, "seed-%"));
  await db.delete(calls).where(like(calls.vaaniCallId, "seed-%"));
  await db.delete(designers).where(like(designers.email, "%@example.invalid"));

  const insertedDesigners = await db.insert(designers).values(seed.designers).returning({ id: designers.id });

  const insertedCalls: { id: number }[] = [];
  for (let i = 0; i < seed.calls.length; i += 50) {
    insertedCalls.push(...(await db.insert(calls).values(seed.calls.slice(i, i + 50)).returning({ id: calls.id })));
  }

  if (seed.bookings.length) {
    await db.insert(bookings).values(
      seed.bookings.map(({ callIndex, designerIndex, ...b }) => ({
        ...b,
        callId: insertedCalls[callIndex].id,
        designerId: insertedDesigners[designerIndex].id,
      })),
    );
  }

  const set = async (key: string, value: unknown) =>
    db.insert(settings).values({ key, value: value as object }).onConflictDoUpdate({ target: settings.key, set: { value: value as object } });
  await set("averageProjectValueInr", 1_100_000);
  await set("fixedMonthlyCostsInr", { vercel: 1700, neon: 1600, hubspot: 3200, calcom: 1000, resend: 1700 });
  if (process.env.SEED_OWNER_EMAIL) {
    await set("users", [{ email: process.env.SEED_OWNER_EMAIL.toLowerCase(), role: "owner" }]);
  }

  console.log(`Seeded ${seed.calls.length} calls, ${seed.bookings.length} bookings, ${seed.designers.length} designers.`);
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exitCode = 1;
  });
