import { getDb } from "@/db";
import { HomeView } from "@/components/home-view";
import { requireViewer } from "@/lib/auth";
import { getAllCalls, getDesigners } from "@/lib/queries";
import { loadSettings } from "@/lib/settings";
import { scopeCalls } from "@/lib/stats";
import { parsePeriod } from "@/lib/time";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  const period = parsePeriod((await searchParams).period);
  const db = await getDb();
  const [all, settings, designers] = await Promise.all([getAllCalls(db), loadSettings(db), getDesigners(db)]);
  return (
    <HomeView
      calls={scopeCalls(all, viewer.scopeDesignerId)}
      settings={settings}
      period={period}
      role={viewer.role}
      now={new Date()}
      designerNames={Object.fromEntries(designers.map((d) => [d.id, d.name]))}
      canAct={!viewer.anonymous}
    />
  );
}
