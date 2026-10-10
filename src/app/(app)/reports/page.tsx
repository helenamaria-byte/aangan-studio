import { getDb } from "@/db";
import { ReportsView } from "@/components/reports-view";
import { requireViewer } from "@/lib/auth";
import { getAllCalls, getBookings, getDesigners } from "@/lib/queries";
import { loadSettings } from "@/lib/settings";

export default async function Reports() {
  await requireViewer();
  const db = await getDb();
  const [all, bookingRows, designerRows, settings] = await Promise.all([getAllCalls(db), getBookings(db), getDesigners(db), loadSettings(db)]);
  return <ReportsView all={all} bookingRows={bookingRows} designerRows={designerRows} settings={settings} now={new Date()} />;
}
