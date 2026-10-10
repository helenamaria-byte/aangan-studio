import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pglite?: Promise<Database>;
  __pgliteClient?: { close(): Promise<void> };
};

/**
 * Production: Neon over HTTP.
 * Local development and tests only: DATABASE_URL=pglite://.pglite uses an embedded Postgres in that folder,
 * so the dashboard can be run and tested with no account. Never used on Vercel.
 */
export async function getDb(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");

  if (url.startsWith("pglite://")) {
    globalForDb.__pglite ??= openPglite(url.slice("pglite://".length));
    return globalForDb.__pglite;
  }
  return drizzle(neon(url), { schema });
}

async function openPglite(dir: string): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dir === "memory" ? undefined : dir);
  globalForDb.__pgliteClient = client;
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  // The embedded database has the same API at runtime; only the TypeScript driver type differs.
  return db as unknown as Database;
}

/** Flush and close the embedded database. Scripts must call this before exiting, or the local data folder is left unflushed. */
export async function closeDb(): Promise<void> {
  await globalForDb.__pgliteClient?.close();
  globalForDb.__pgliteClient = undefined;
  globalForDb.__pglite = undefined;
}

export { schema };
