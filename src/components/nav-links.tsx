"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Main navigation. The current page is marked with a brass underline. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = l.href === "/studio" ? path === "/studio" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap px-2.5 py-1.5 transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}
          >
            {l.label}
            {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-0.5 h-px bg-brass" />}
          </Link>
        );
      })}
    </>
  );
}
