import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { viewerFor } from "../src/lib/auth";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("open viewing (no sign-in needed to look)", () => {
  it("a visitor who is not signed in can look, as a read-only owner view", () => {
    expect(viewerFor(null, false)).toMatchObject({ role: "owner", anonymous: true });
  });
  it("REQUIRE_LOGIN=true locks the dashboard again", () => {
    expect(viewerFor(null, true)).toBeNull();
  });
  it("a signed-in person is shown as themselves, with their own role, not as a visitor", () => {
    const desk = { email: "desk@x.test", role: "front_desk" as const };
    expect(viewerFor(desk, false)).toEqual(desk);
    expect(viewerFor(desk, true)).toEqual(desk);
  });
});

describe("visitors can look but never change anything", () => {
  const actions = read("src/app/actions.ts");
  // Every exported server action except the two that start or end a sign-in must check for a real signed-in user.
  const fns = [...actions.matchAll(/export async function (\w+)\([^)]*\)\s*\{([\s\S]*?)\n\}/g)];

  it("finds the server actions", () => {
    expect(fns.map((m) => m[1])).toEqual(
      expect.arrayContaining(["markHandled", "retryFailed", "saveOfficeHours", "saveEmails", "saveMoney", "saveUsers", "addDesigner", "toggleDesigner"]),
    );
  });
  it.each(fns.filter((m) => !["requestLogin", "logout"].includes(m[1])).map((m) => [m[1], m[2]]))(
    "%s requires a real sign-in, not the visitor view",
    (_name, body) => {
      expect(body).toMatch(/requireUser\(/);
      expect(body).not.toMatch(/requireViewer|viewerFor/);
    },
  );

  it("Settings and the spreadsheet download still need a real sign-in", () => {
    expect(read("src/app/(app)/settings/page.tsx")).toMatch(/requireUser\("owner"\)/);
    expect(read("src/app/(app)/calls/export/route.ts")).toMatch(/getSession\(\)/);
    expect(read("src/app/(app)/calls/export/route.ts")).not.toMatch(/requireViewer|viewerFor/);
  });
  it("only the looking pages use the visitor view", () => {
    for (const f of ["src/app/(app)/studio/page.tsx", "src/app/(app)/calls/page.tsx", "src/app/(app)/reports/page.tsx", "src/app/(app)/calls/[id]/page.tsx", "src/app/(app)/layout.tsx"]) {
      expect(read(f), f).toMatch(/requireViewer/);
    }
  });
});
