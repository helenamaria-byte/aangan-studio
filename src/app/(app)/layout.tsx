import Link from "next/link";
import { logout } from "@/app/actions";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireViewer();
  const links = [
    { href: "/", label: "Home" },
    { href: "/calls", label: "Calls" },
    ...(user.role === "owner" ? [{ href: "/reports", label: "Reports" }] : []),
    ...(user.role === "owner" && !user.anonymous ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5">
        <Link href="/" className="text-lg font-medium">
          Aangan Studio
        </Link>
        <nav aria-label="Main" className="flex items-center text-base">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-muted hover:text-text">
              {l.label}
            </Link>
          ))}
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
      {user.anonymous && (
        <p role="note" className="mb-4 rounded-lg bg-text/5 px-4 py-3 text-sm text-muted">
          You are looking without signing in, so this view is read-only. Sign in to change anything.
        </p>
      )}
      <main>{children}</main>
    </div>
  );
}
