import type { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { DEFAULT_OFFICE_HOURS, type OfficeHours } from "./time";

export type Db = ReturnType<typeof getDb>;

export interface AppSettings {
  officeHours: OfficeHours;
  usdToInr: number;
  frontDeskEmail: string | null;
  ownerEmail: string | null;
  averageProjectValueInr: number;
}

/** Environment values are the starting point. A row in the settings table (edited on the Settings page) wins. */
export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.select().from(settingsTable);
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    officeHours: (m.get("officeHours") as OfficeHours | undefined) ?? DEFAULT_OFFICE_HOURS,
    usdToInr: Number(m.get("usdToInr") ?? process.env.USD_TO_INR ?? 85),
    frontDeskEmail: (m.get("frontDeskEmail") as string | undefined) ?? process.env.FRONT_DESK_EMAIL ?? null,
    ownerEmail: (m.get("ownerEmail") as string | undefined) ?? process.env.OWNER_EMAIL ?? null,
    averageProjectValueInr: Number(m.get("averageProjectValueInr") ?? 1_100_000),
  };
}
