import { CallsView } from "@/components/calls-view";
import { getDemoData } from "@/lib/demo-data";

export default async function DemoCalls({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CallsView all={getDemoData().calls} sp={await searchParams} base="/demo" canExport={false} />;
}
