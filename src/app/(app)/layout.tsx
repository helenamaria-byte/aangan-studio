import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { logout } from "@/app/actions";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireViewer();
  const links = [
    { href: "/studio", label: "Home" },
    { href: "/calls", label: "Calls" },
    ...(user.role === "owner" ? [{ href: "/reports", label: "Reports" }] : []),
    ...(user.role === "owner" && !user.anonymous ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4 pt-7">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center text-base">
          <NavLinks links={links} />
          {user.anonymous ? (
            <Link href="/login" className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-muted hover:text-text">
              Sign in
            </Link>
          ) : (
            <form action={logout}>
              <button className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-muted hover:text-text" title={user.email}>
                Sign out
              </button>
            </form>
          )}
        </nav>
      </header>
      <div className="brass-rule mb-6" aria-hidden />
      {user.anonymous && (
        <p role="note" className="mb-6 rounded-lg bg-text/5 px-4 py-3 text-sm text-muted">
          You are looking without signing in, so this view is read-only. Sign in to change anything.
        </p>
      )}
      <main className="dash-enter">{children}</main>
    </div>
  );
}
