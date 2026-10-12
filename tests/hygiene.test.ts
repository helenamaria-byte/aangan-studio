import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", ".pglite", "vaani-pack"]);

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx|mjs|js|css|json|md)$/.test(f)) out.push(p);
  }
  return out;
}

describe("source files stay clean", () => {
  it("contain no stray control characters (a backslash escape once turned into a backspace and silently broke patterns)", () => {
    const bad: string[] = [];
    for (const p of files(ROOT)) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          // Tab, line feed and carriage return are fine. Anything else below space is not.
          // eslint-disable-next-line no-control-regex
          if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line)) bad.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
        });
    }
    expect(bad).toEqual([]);
  });
});
