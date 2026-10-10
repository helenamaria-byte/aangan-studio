import { getDb } from "@/db";
import { HomeView } from "@/components/home-view";
import { requireUser } from "@/lib/auth";
import { getAllCalls } from "@/lib/queries";
import { loadSettings } from "@/lib/settings";
import { parsePeriod } from "@/lib/time";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const period = parsePeriod((await searchParams).period);
  const db = await getDb();
  const [calls, settings] = await Promise.all([getAllCalls(db), loadSettings(db)]);
  return <HomeView calls={calls} settings={settings} period={period} role={user.role} now={new Date()} />;
}
