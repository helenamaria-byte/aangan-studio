import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("entry page (the doors)", () => {
  it("needs no database or sign-in, so it always opens", () => {
    for (const f of ["src/app/page.tsx", "src/components/door-entry.tsx"]) {
      expect(read(f), f).not.toMatch(/from "@\/db"|getDb|requireUser|requireViewer|getSession/);
    }
  });

  it("opens the doors, then goes to the dashboard at /studio", () => {
    const src = read("src/components/door-entry.tsx");
    expect(src).toMatch(/router\.push\("\/studio"\)/);
    expect(src).toMatch(/Let&rsquo;s get in/);
  });

  it("people who prefer less motion skip the animation and go straight in", () => {
    expect(read("src/components/door-entry.tsx")).toMatch(/prefers-reduced-motion: reduce/);
    expect(read("src/app/globals.css")).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("the entry animations never freeze their end state, so the later 'doors open' styles can take over", () => {
    const css = read("src/components/door.module.css");
    // fill-mode "both" or "forwards" would hold the faded-in style and block the fade-out and the walk-in zoom
    expect(css).not.toMatch(/animation:[^;]*\b(both|forwards)\b/);
  });

  it("every page that used to link to the dashboard at / now points to /studio", () => {
    expect(read("src/app/api/auth/verify/route.ts")).toMatch(/"\/studio"/);
    expect(read("src/app/login/page.tsx")).toMatch(/redirect\("\/studio"\)/);
    expect(read("src/components/ui.tsx")).toMatch(/\/studio/);
    expect(read("src/app/(app)/layout.tsx")).toMatch(/href: "\/studio"/);
  });
});
