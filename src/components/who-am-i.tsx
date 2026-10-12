import Link from "next/link";
import { logout } from "@/app/actions";
import type { Viewer } from "@/lib/auth";

const ROLE_LABEL = { owner: "Owner", front_desk: "Front desk", designer: "Designer" } as const;

const initials = (name: string) =>
  name
    .replace(/^designer\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Who is logged in: a monogram, their name, their role, and a way to sign out (or in). */
export function WhoAmI({ viewer }: { viewer: Viewer }) {
  const line = viewer.anonymous
    ? "Looking around, read-only"
    : viewer.viewingAs
      ? `${ROLE_LABEL[viewer.realRole]} · viewing as ${viewer.viewingAs.name}`
      : ROLE_LABEL[viewer.role];

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-text/90 text-sm font-medium text-bg">
        {viewer.anonymous ? "G" : initials(viewer.name)}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-medium">{viewer.name}</div>
        <div className="text-xs text-muted">{line}</div>
      </div>
      {viewer.anonymous ? (
        <Link href="/login" className="ml-1 rounded-full border border-text/15 px-3 py-1.5 text-sm hover:border-text/30">
          Sign in
        </Link>
      ) : (
        <form action={logout}>
          <button className="ml-1 rounded-full px-2 py-1.5 text-sm text-muted hover:text-text" title={viewer.email}>
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
