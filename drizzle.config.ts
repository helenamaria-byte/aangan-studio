import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local by itself. Load it so `npm run db:migrate` uses the same address as the app.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (for example in CI): fall back to the real environment.
}

if ((process.env.DATABASE_URL ?? "").startsWith("pglite://")) {
  throw new Error(
    "DATABASE_URL points at the local embedded database. Put your Neon connection string in .env.local before running a Neon migration.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
