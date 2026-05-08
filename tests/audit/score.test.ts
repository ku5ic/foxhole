import { describe, it, expect } from "vitest";

import { scoreFindings, scorePage, scoreReport } from "../../src/audit/score.js";
import type {
  CategorySummary,
  Finding,
  PageResult,
  PerformanceMetrics,
} from "../../src/types/index.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "test-finding",
    category: "a11y",
    severity: "minor",
    effort: "low",
    rule_id: "a11y/test",
    title: "Test finding",
    description: "A test finding.",
    recommendation: "Fix it.",
    selector: null,
    wcag: null,
    impact: null,
    source: null,
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
    status: "ok",
    error: null,
    score: 0,
    categories: [],
    findings,
    metrics: emptyMetrics(),
    audited_at: "2026-04-07T00:00:00.000Z",
    duration_ms: 0,
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
  it("always returns exactly 4 categories covering all check types", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
    ]);

    const scored = scorePage(original, ["a11y"]);

    expect(scored.categories).toHaveLength(4);
    const cats = scored.categories.map((c) => c.category);
    expect(cats).toContain("a11y");
    expect(cats).toContain("perf");
    expect(cats).toContain("semantic");
    expect(cats).toContain("bundle");
  });

  it("marks non-requested categories as skipped", () => {
    const original = makePageResult([]);
    const scored = scorePage(original, ["a11y", "semantic"]);

    const perf = scored.categories.find((c) => c.category === "perf");
    const bundle = scored.categories.find((c) => c.category === "bundle");
    expect(perf?.status).toBe("skipped");
    expect(bundle?.status).toBe("skipped");
  });

  it("scores page as the average of ok category scores, excluding skipped", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
      makeFinding({ id: "f2", category: "semantic", severity: "minor" }),
    ]);

    // requestedChecks: a11y + semantic -> a11y score 85, semantic score 98
    // perf and bundle are skipped, excluded from average
    // Math.round((85 + 98) / 2) = Math.round(91.5) = 92
    const scored = scorePage(original, ["a11y", "semantic"]);

    expect(scored.score).toBe(92);

    const a11yCat = scored.categories.find((c) => c.category === "a11y");
    expect(a11yCat?.status).toBe("ok");
    expect(a11yCat?.critical_count).toBe(1);
    expect(a11yCat?.score).toBe(85);

    const semanticCat = scored.categories.find((c) => c.category === "semantic");
    expect(semanticCat?.status).toBe("ok");
    expect(semanticCat?.minor_count).toBe(1);
    expect(semanticCat?.score).toBe(98);
  });

  it("includes all four categories in the score when no requestedChecks override is given", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
      makeFinding({ id: "f2", category: "semantic", severity: "minor" }),
    ]);

    // all 4 requested: a11y=85, perf=100, semantic=98, bundle=100
    // Math.round((85 + 100 + 98 + 100) / 4) = Math.round(95.75) = 96
    const scored = scorePage(original);

    expect(scored.score).toBe(96);
    expect(scored.categories).toHaveLength(4);
  });

  it("preserves errored categories from the runner layer", () => {
    const erroredCategory: CategorySummary = {
      category: "a11y",
      status: "errored",
      error: { message: "axe crashed" },
      score: 0,
      findings_count: 0,
      critical_count: 0,
      major_count: 0,
      minor_count: 0,
    };
    const original: PageResult = {
      ...makePageResult([]),
      categories: [erroredCategory],
    };

    const scored = scorePage(original, ["a11y", "semantic"]);

    expect(scored.categories).toHaveLength(4);

    const a11yCat = scored.categories.find((c) => c.category === "a11y");
    expect(a11yCat?.status).toBe("errored");
    expect(a11yCat?.error?.message).toBe("axe crashed");

    // errored category is excluded from the score average; only semantic (ok) contributes
    const semanticCat = scored.categories.find((c) => c.category === "semantic");
    expect(semanticCat?.status).toBe("ok");
    expect(semanticCat?.score).toBe(100);

    // score is average of ok categories only: semantic = 100
    expect(scored.score).toBe(100);
  });

  it("returns score 0 when all requested categories are errored", () => {
    const erroredA11y: CategorySummary = {
      category: "a11y",
      status: "errored",
      error: { message: "failed" },
      score: 0,
      findings_count: 0,
      critical_count: 0,
      major_count: 0,
      minor_count: 0,
    };
    const original: PageResult = {
      ...makePageResult([]),
      categories: [erroredA11y],
    };

    const scored = scorePage(original, ["a11y"]);

    expect(scored.score).toBe(0);
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

  it("returns average score across ok pages", () => {
    const pages: PageResult[] = [
      { ...makePageResult([]), score: 80 },
      { ...makePageResult([]), score: 60 },
    ];
    expect(scoreReport(pages)).toBe(70);
  });

  it("returns 0 when all pages are errored", () => {
    const errored: PageResult = {
      ...makePageResult([]),
      status: "errored",
      error: { message: "failed" },
      score: 0,
    };
    expect(scoreReport([errored])).toBe(0);
  });

  it("excludes errored pages from the average", () => {
    const ok: PageResult = { ...makePageResult([]), score: 80 };
    const errored: PageResult = {
      ...makePageResult([]),
      status: "errored",
      error: { message: "failed" },
      score: 0,
    };
    expect(scoreReport([ok, errored])).toBe(80);
  });
});
