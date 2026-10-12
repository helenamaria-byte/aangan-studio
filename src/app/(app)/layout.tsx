import { getDb } from "@/db";
import { Wordmark } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { ViewAsSelect } from "@/components/view-as-select";
import { WhoAmI } from "@/components/who-am-i";
import { requireViewer } from "@/lib/auth";
import { getDesigners } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();

  // What each person can open. A designer sees their own leads; the owner can also preview a designer's view.
  const links = [
    { href: "/studio", label: viewer.role === "designer" ? "My leads" : "Home" },
    { href: "/calls", label: viewer.role === "designer" ? "My calls" : "Calls" },
    ...(viewer.role === "owner" ? [{ href: "/reports", label: "Reports" }] : []),
    ...(viewer.role === "owner" && !viewer.anonymous ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  const canSwitch = viewer.realRole === "owner" && !viewer.anonymous;
  const designers = canSwitch ? (await getDesigners(await getDb())).filter((d) => d.active) : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pb-5 pt-8">
        <Wordmark />
        <WhoAmI viewer={viewer} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-text/10 pb-3">
        <nav aria-label="Main" className="-ml-2.5 flex items-center text-base">
          <NavLinks links={links} />
        </nav>
        {canSwitch && designers.length > 0 && <ViewAsSelect designers={designers} current={viewer.viewingAs?.id ?? null} />}
      </div>

      <main className="dash-enter pt-10">{children}</main>

      <footer className="mt-20 border-t border-text/10 pt-6 text-center text-sm text-muted">Aangan Studio · Pune</footer>
    </div>
  );
}
