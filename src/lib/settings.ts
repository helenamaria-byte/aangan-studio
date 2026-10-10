import type { Database } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { DEFAULT_OFFICE_HOURS, type OfficeHours } from "./time";

export type Db = Database;

export type Role = "owner" | "front_desk";

export interface AppUser {
  email: string;
  role: Role;
}

export const FIXED_COST_KEYS = ["vercel", "neon", "hubspot", "calcom", "resend"] as const;
export type FixedCosts = Record<(typeof FIXED_COST_KEYS)[number], number>;

export interface AppSettings {
  officeHours: OfficeHours;
  usdToInr: number;
  frontDeskEmail: string | null;
  ownerEmail: string | null;
  averageProjectValueInr: number;
  /** Monthly plan costs of each tool, in rupees, entered once on the Settings page. */
  fixedMonthlyCostsInr: FixedCosts;
  /** Who may sign in to the dashboard. */
  users: AppUser[];
  /** The number callers dial, for empty-state messages. */
  studioPhone: string | null;
}

export const DEFAULT_FIXED_COSTS: FixedCosts = { vercel: 0, neon: 0, hubspot: 0, calcom: 0, resend: 0 };

/** Environment values are the starting point. A row in the settings table (edited on the Settings page) wins. */
export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.select().from(settingsTable);
  const m = new Map(rows.map((r) => [r.key, r.value]));

  const ownerEmail = (m.get("ownerEmail") as string | undefined) ?? process.env.OWNER_EMAIL ?? null;
  const frontDeskEmail = (m.get("frontDeskEmail") as string | undefined) ?? process.env.FRONT_DESK_EMAIL ?? null;

  const envUsers: AppUser[] = [
    ...(ownerEmail ? [{ email: ownerEmail.toLowerCase(), role: "owner" as const }] : []),
    ...(frontDeskEmail ? [{ email: frontDeskEmail.toLowerCase(), role: "front_desk" as const }] : []),
  ];

  return {
    officeHours: (m.get("officeHours") as OfficeHours | undefined) ?? DEFAULT_OFFICE_HOURS,
    usdToInr: Number(m.get("usdToInr") ?? process.env.USD_TO_INR ?? 85),
    frontDeskEmail,
    ownerEmail,
    averageProjectValueInr: Number(m.get("averageProjectValueInr") ?? 1_100_000),
    fixedMonthlyCostsInr: { ...DEFAULT_FIXED_COSTS, ...((m.get("fixedMonthlyCostsInr") as Partial<FixedCosts> | undefined) ?? {}) },
    users: (m.get("users") as AppUser[] | undefined) ?? envUsers,
    studioPhone: (m.get("studioPhone") as string | undefined) ?? process.env.STUDIO_PHONE ?? null,
  };
}
