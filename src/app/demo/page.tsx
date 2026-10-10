import { HomeView } from "@/components/home-view";
import { getDemoData } from "@/lib/demo-data";
import { parsePeriod } from "@/lib/time";

export default async function DemoHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const now = new Date();
  const d = getDemoData(now);
  return <HomeView calls={d.calls} settings={d.settings} period={parsePeriod((await searchParams).period)} role="owner" now={now} base="/demo" readOnly />;
}
