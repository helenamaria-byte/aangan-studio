import { ReportsView } from "@/components/reports-view";
import { getDemoData } from "@/lib/demo-data";

export default function DemoReports() {
  const now = new Date();
  const d = getDemoData(now);
  return <ReportsView all={d.calls} bookingRows={d.bookings} designerRows={d.designers} settings={d.settings} now={now} />;
}
