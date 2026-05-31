import { describe, it, expect } from "vitest";

import { prioritizeFindings } from "../../src/audit/prioritize.js";
import type { Finding } from "../../src/types/index.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    category: "a11y",
    severity: "minor",
    effort: "low",
    rule_id: "a11y/image-alt",
    title: "Images must have alternative text",
    description: "Desc",
    recommendation: "Fix it",
    selector: null,
    wcag: null,
    impact: null,
    source: null,
    url: "https://example.com",
    ...overrides,
  };
}

describe("prioritizeFindings", () => {
  it("returns an empty array for no findings", () => {
    expect(prioritizeFindings([])).toHaveLength(0);
  });

  it("groups findings by rule_id", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "a11y/image-alt" }),
      makeFinding({ id: "b", rule_id: "a11y/image-alt" }),
      makeFinding({ id: "c", rule_id: "semantic/missing-h1" }),
    ];
    const fixes = prioritizeFindings(findings);
    expect(fixes).toHaveLength(2);
    const altFix = fixes.find((f) => f.rule_id === "a11y/image-alt");
    expect(altFix?.finding_ids).toHaveLength(2);
  });

  it("uses max severity across the group, not first (PRIO-1)", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "a11y/image-alt", severity: "minor" }),
      makeFinding({ id: "b", rule_id: "a11y/image-alt", severity: "critical" }),
      makeFinding({ id: "c", rule_id: "a11y/image-alt", severity: "major" }),
    ];
    const [fix] = prioritizeFindings(findings);
    expect(fix?.severity).toBe("critical");
  });

  it("uses max effort across the group, not first (PRIO-1)", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "a11y/image-alt", effort: "low" }),
      makeFinding({ id: "b", rule_id: "a11y/image-alt", effort: "high" }),
    ];
    const [fix] = prioritizeFindings(findings);
    expect(fix?.effort).toBe("high");
  });

  it("produces sequential ranks starting at 1", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "a11y/image-alt", severity: "critical" }),
      makeFinding({ id: "b", rule_id: "semantic/missing-h1", severity: "minor" }),
    ];
    const fixes = prioritizeFindings(findings);
    const ranks = fixes.map((f) => f.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2]);
  });

  it("sorts critical fixes before minor fixes", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "semantic/missing-h1", severity: "minor" }),
      makeFinding({ id: "b", rule_id: "a11y/image-alt", severity: "critical" }),
    ];
    const fixes = prioritizeFindings(findings);
    expect(fixes[0]?.severity).toBe("critical");
    expect(fixes[1]?.severity).toBe("minor");
  });

  it("collects pages_affected across all findings in the group", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "a11y/image-alt", url: "https://example.com/a" }),
      makeFinding({ id: "b", rule_id: "a11y/image-alt", url: "https://example.com/b" }),
      makeFinding({ id: "c", rule_id: "a11y/image-alt", url: "https://example.com/a" }),
    ];
    const [fix] = prioritizeFindings(findings);
    expect(fix?.pages_affected).toHaveLength(2);
    expect(fix?.pages_affected).toContain("https://example.com/a");
    expect(fix?.pages_affected).toContain("https://example.com/b");
  });
});
