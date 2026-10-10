import { getDb } from "@/db";
import { getSession } from "@/lib/auth";
import { parseCallFilters } from "@/lib/params";
import { getAllCalls } from "@/lib/queries";
import { callsToCsv, filterCalls } from "@/lib/stats";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new Response("Sign in first", { status: 401 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = filterCalls(await getAllCalls(await getDb()), parseCallFilters(sp));
  // The front desk never sees costs, in the app or in exports.
  const csv = callsToCsv(rows, user.role === "owner");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aangan-calls.csv"',
      "Cache-Control": "no-store",
    },
  });
}
