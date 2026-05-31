import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { readPackageJsonVersion } from "../src/version.js";

const TMP = join(tmpdir(), "foxhole-version-test");

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("readPackageJsonVersion", () => {
  it("returns the version string from a valid package.json", () => {
    const p = join(TMP, "valid.json");
    writeFileSync(p, JSON.stringify({ version: "1.2.3" }));
    expect(readPackageJsonVersion(p)).toBe("1.2.3");
  });

  it("returns 'unknown' when the file does not exist", () => {
    expect(readPackageJsonVersion(join(TMP, "nonexistent.json"))).toBe("unknown");
  });

  it("returns 'unknown' when the JSON is malformed", () => {
    const p = join(TMP, "bad.json");
    writeFileSync(p, "{ not valid json }");
    expect(readPackageJsonVersion(p)).toBe("unknown");
  });

  it("returns 'unknown' when the version field is absent", () => {
    const p = join(TMP, "no-version.json");
    writeFileSync(p, JSON.stringify({ name: "test" }));
    expect(readPackageJsonVersion(p)).toBe("unknown");
  });

  it("returns 'unknown' when version is a number, not a string", () => {
    const p = join(TMP, "number-version.json");
    writeFileSync(p, JSON.stringify({ version: 1 }));
    expect(readPackageJsonVersion(p)).toBe("unknown");
  });

  it("returns 'unknown' when version is null", () => {
    const p = join(TMP, "null-version.json");
    writeFileSync(p, JSON.stringify({ version: null }));
    expect(readPackageJsonVersion(p)).toBe("unknown");
  });
});
