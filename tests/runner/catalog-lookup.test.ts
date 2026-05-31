import { describe, it, expect, vi } from "vitest";

import { catalogLookup } from "../../src/runner/catalog-lookup.js";

describe("catalogLookup", () => {
  it("returns the catalog entry for a known ruleId", () => {
    const entry = catalogLookup("a11y/image-alt");
    expect(entry).toBeDefined();
    expect(entry?.rule_id).toBe("a11y/image-alt");
  });

  it("returns undefined for an unknown ruleId", () => {
    expect(catalogLookup("bundle/unknown-rule-xyz")).toBeUndefined();
  });

  it("emits a debug warning to stderr when FOXHOLE_DEBUG=1 and rule is unknown", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    process.env.FOXHOLE_DEBUG = "1";

    catalogLookup("bundle/unknown-rule-xyz");

    expect(stderr).toHaveBeenCalledWith(
      "[foxhole:debug] catalog gap: ruleId=bundle/unknown-rule-xyz\n",
    );

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });

  it("does not emit a warning when FOXHOLE_DEBUG is unset", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    delete process.env.FOXHOLE_DEBUG;

    catalogLookup("bundle/unknown-rule-xyz");

    expect(stderr).not.toHaveBeenCalled();

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });

  it("does not emit a warning for a known rule even when FOXHOLE_DEBUG=1", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    process.env.FOXHOLE_DEBUG = "1";

    catalogLookup("a11y/image-alt");

    expect(stderr).not.toHaveBeenCalled();

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });
});
