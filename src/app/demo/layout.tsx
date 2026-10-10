import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Aangan Studio demo" };

// Public, read-only demo on built-in sample data. No sign-in, no database, every button switched off.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const links = [
    { href: "/demo", label: "Home" },
    { href: "/demo/calls", label: "Calls" },
    { href: "/demo/reports", label: "Reports" },
  ];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div role="note" className="mt-4 rounded-lg bg-accent/10 px-4 py-3 text-sm text-accent">
        This is a demo with made-up callers and numbers. Nothing here is real, and the buttons are switched off.
      </div>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5">
        <Link href="/demo" className="text-lg font-medium">
          Aangan Studio
        </Link>
        <nav aria-label="Main" className="flex items-center text-base">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-muted hover:text-text">
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-muted hover:text-text">
            Sign in
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
