import { describe, it, expect } from "vitest";

import { scoreFindings, scorePage, scoreReport } from "../../src/audit/score.js";
import type { Finding, PageResult, PerformanceMetrics } from "../../src/types/index.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "test-finding",
    category: "a11y",
    severity: "minor",
    effort: "low",
    title: "Test finding",
    description: "A test finding.",
    recommendation: "Fix it.",
    selector: null,
    wcag: null,
    impact: null,
    url: "https://example.com",
    ...overrides,
  };
}

function emptyMetrics(): PerformanceMetrics {
  return {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    tbt: null,
    performance_score: null,
    accessibility_score: null,
    bundle_size: null,
  };
}

function makePageResult(findings: Finding[]): PageResult {
  return {
    url: "https://example.com",
    score: 0,
    categories: [],
    findings,
    metrics: emptyMetrics(),
    audited_at: "2026-04-07T00:00:00.000Z",
  };
}

describe("scoreFindings", () => {
  it("returns 100 for empty findings array", () => {
    expect(scoreFindings([])).toBe(100);
  });

  it("returns 85 for one critical finding", () => {
    const findings = [makeFinding({ severity: "critical" })];
    expect(scoreFindings(findings)).toBe(85);
  });

  it("returns 92 for one major finding", () => {
    const findings = [makeFinding({ severity: "major" })];
    expect(scoreFindings(findings)).toBe(92);
  });

  it("returns 98 for one minor finding", () => {
    const findings = [makeFinding({ severity: "minor" })];
    expect(scoreFindings(findings)).toBe(98);
  });

  it("returns correct score for mixed findings", () => {
    const findings = [
      makeFinding({ id: "f1", severity: "critical" }),
      makeFinding({ id: "f2", severity: "major" }),
      makeFinding({ id: "f3", severity: "minor" }),
    ];
    // 100 - 15 - 8 - 2 = 75
    expect(scoreFindings(findings)).toBe(75);
  });

  it("floors at 0 when deductions exceed 100", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ id: `f${String(i)}`, severity: "critical" }),
    );
    // 100 - (15 * 10) = -50, floors at 0
    expect(scoreFindings(findings)).toBe(0);
  });
});

describe("scorePage", () => {
  it("returns a new PageResult with computed score and categories", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
      makeFinding({ id: "f2", category: "semantic", severity: "minor" }),
    ]);

    const scored = scorePage(original);

    expect(scored).not.toBe(original);
    // 100 - 15 - 2 = 83
    expect(scored.score).toBe(83);
    expect(scored.categories).toHaveLength(2);

    const a11yCat = scored.categories.find((c) => c.category === "a11y");
    expect(a11yCat).toBeDefined();
    expect(a11yCat?.critical_count).toBe(1);
    expect(a11yCat?.score).toBe(85);

    const semanticCat = scored.categories.find((c) => c.category === "semantic");
    expect(semanticCat).toBeDefined();
    expect(semanticCat?.minor_count).toBe(1);
    expect(semanticCat?.score).toBe(98);
  });

  it("does not mutate the input", () => {
    const original = makePageResult([makeFinding({ severity: "critical" })]);
    scorePage(original);
    expect(original.score).toBe(0);
    expect(original.categories).toHaveLength(0);
  });
});

describe("scoreReport", () => {
  it("returns 100 for empty pages array", () => {
    expect(scoreReport([])).toBe(100);
  });

  it("returns average score across pages", () => {
    const pages: PageResult[] = [
      { ...makePageResult([]), score: 80 },
      { ...makePageResult([]), score: 60 },
    ];
    expect(scoreReport(pages)).toBe(70);
  });
});
