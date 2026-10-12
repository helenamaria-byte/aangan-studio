import { getDb } from "@/db";
import { CallsView } from "@/components/calls-view";
import { requireViewer } from "@/lib/auth";
import { getAllCalls, getDesigners } from "@/lib/queries";
import { scopeCalls } from "@/lib/stats";

export default async function Calls({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  const db = await getDb();
  const [all, designers] = await Promise.all([getAllCalls(db), getDesigners(db)]);
  return (
    <CallsView
      all={scopeCalls(all, viewer.scopeDesignerId)}
      sp={await searchParams}
      title={viewer.role === "designer" ? "My calls" : "All calls"}
      designerNames={viewer.role === "designer" ? undefined : Object.fromEntries(designers.map((d) => [d.id, d.name]))}
      canEdit={!viewer.anonymous}
      canExport={!viewer.anonymous && viewer.role !== "designer"}
    />
  );
}
