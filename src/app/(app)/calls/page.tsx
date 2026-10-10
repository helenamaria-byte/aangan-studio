import { getDb } from "@/db";
import { CallsView } from "@/components/calls-view";
import { requireViewer } from "@/lib/auth";
import { getAllCalls } from "@/lib/queries";

export default async function Calls({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireViewer();
  return <CallsView all={await getAllCalls(await getDb())} sp={await searchParams} />;
}
