import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDemoData } from "../src/lib/demo-data";
import { attentionItems, homeStats } from "../src/lib/stats";

const NOW = new Date("2026-10-10T12:00:00Z");

describe("public demo", () => {
  it("has a realistic month of made-up calls, with the same data for the whole hour", () => {
    const a = getDemoData(NOW);
    const b = getDemoData(new Date(NOW.getTime() + 20 * 60_000));
    expect(a.calls.length).toBeGreaterThan(150);
    expect(a.calls.map((c) => c.id)).toEqual(b.calls.map((c) => c.id));
    expect(a.calls.every((c) => (c.callerPhone ?? "").startsWith("+9198") || c.callerPhone === null)).toBe(true);
  });

  it("shows the home numbers and something under Needs attention", () => {
    const d = getDemoData(NOW);
    expect(homeStats(d.calls, d.settings, "month", NOW).total).toBeGreaterThan(0);
    expect(attentionItems(d.calls, NOW).length).toBeGreaterThan(0);
  });

  it("never touches the database, sign-in, or any server action", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        statSync(p).isDirectory() ? walk(p) : files.push(p);
      }
    };
    walk(join(__dirname, "..", "src", "app", "demo"));
    files.push(join(__dirname, "..", "src", "lib", "demo-data.ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/from "@\/db"|getDb|requireUser|getSession|@\/app\/actions|"use server"/);
    }
  });
});
