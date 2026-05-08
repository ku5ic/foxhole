import { describe, it, expect } from "vitest";

import { catalog } from "../../src/catalog/index.js";

const CHECK_CATEGORIES = ["a11y", "perf", "semantic", "bundle"] as const;
const SEVERITIES = ["critical", "major", "minor"] as const;
const EFFORTS = ["low", "medium", "high"] as const;
const SOURCES = ["axe", "lighthouse", "semantic", "bundle"] as const;

describe("catalog structure", () => {
  it("is a non-empty record", () => {
    expect(Object.keys(catalog).length).toBeGreaterThan(0);
  });

  it("every key matches its entry rule_id", () => {
    for (const [key, entry] of Object.entries(catalog)) {
      expect(entry.rule_id).toBe(key);
    }
  });

  it("every entry has a valid category", () => {
    for (const entry of Object.values(catalog)) {
      expect(CHECK_CATEGORIES).toContain(entry.category);
    }
  });

  it("every entry has a valid default_severity", () => {
    for (const entry of Object.values(catalog)) {
      expect(SEVERITIES).toContain(entry.default_severity);
    }
  });

  it("every entry has a valid default_effort", () => {
    for (const entry of Object.values(catalog)) {
      expect(EFFORTS).toContain(entry.default_effort);
    }
  });

  it("every entry has a valid source", () => {
    for (const entry of Object.values(catalog)) {
      expect(SOURCES).toContain(entry.source);
    }
  });

  it("every entry has non-empty title_template and recommendation", () => {
    for (const [key, entry] of Object.entries(catalog)) {
      expect(entry.title_template.length, `${key} title_template`).toBeGreaterThan(0);
      expect(entry.recommendation.length, `${key} recommendation`).toBeGreaterThan(0);
    }
  });

  it("wcag is null for non-a11y entries", () => {
    for (const entry of Object.values(catalog)) {
      if (entry.category !== "a11y") {
        expect(entry.wcag, `${entry.rule_id} wcag`).toBeNull();
      }
    }
  });

  it("source matches category namespace", () => {
    for (const entry of Object.values(catalog)) {
      if (entry.category === "a11y") expect(entry.source).toBe("axe");
      if (entry.category === "perf") expect(entry.source).toBe("lighthouse");
      if (entry.category === "semantic") expect(entry.source).toBe("semantic");
      if (entry.category === "bundle") expect(entry.source).toBe("bundle");
    }
  });
});

describe("catalog coverage", () => {
  it("contains at least one entry per category", () => {
    const categories = new Set(Object.values(catalog).map((e) => e.category));
    expect(categories.has("a11y")).toBe(true);
    expect(categories.has("perf")).toBe(true);
    expect(categories.has("semantic")).toBe(true);
    expect(categories.has("bundle")).toBe(true);
  });

  it("contains the four bundle rules", () => {
    expect(catalog["bundle/total-js-size"]).toBeDefined();
    expect(catalog["bundle/large-javascript-chunk"]).toBeDefined();
    expect(catalog["bundle/total-css-size"]).toBeDefined();
    expect(catalog["bundle/insecure-resource"]).toBeDefined();
  });

  it("contains key a11y rules", () => {
    expect(catalog["a11y/image-alt"]).toBeDefined();
    expect(catalog["a11y/label"]).toBeDefined();
    expect(catalog["a11y/color-contrast"]).toBeDefined();
  });

  it("contains the seven semantic rules", () => {
    const semanticEntries = Object.values(catalog).filter((e) => e.category === "semantic");
    expect(semanticEntries.length).toBe(7);
  });
});
