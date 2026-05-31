import { describe, it, expect } from "vitest";

import { scoreFromFindings, scorePage, scoreReport } from "../../src/audit/score.js";
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

// Curve reference (SEVERITY_WEIGHTS: critical=10, major=4, minor=1, SCORE_SCALE=40):
// W=1  (1 minor)          -> round(100 * exp(-1/40))   = 98
// W=4  (1 major)          -> round(100 * exp(-4/40))   = 90
// W=10 (1 critical)       -> round(100 * exp(-10/40))  = 78
// W=11 (1 critical+minor) -> round(100 * exp(-11/40))  = 76
// W=15 (mixed)            -> round(100 * exp(-15/40))  = 69
// W=100 (10 criticals)    -> round(100 * exp(-100/40)) = 8

describe("scoreFromFindings", () => {
  it("returns 100 for empty findings array", () => {
    expect(scoreFromFindings([])).toBe(100);
  });

  it("returns 78 for one critical finding", () => {
    const findings = [makeFinding({ severity: "critical" })];
    expect(scoreFromFindings(findings)).toBe(78);
  });

  it("returns 90 for one major finding", () => {
    const findings = [makeFinding({ severity: "major" })];
    expect(scoreFromFindings(findings)).toBe(90);
  });

  it("returns 98 for one minor finding", () => {
    const findings = [makeFinding({ severity: "minor" })];
    expect(scoreFromFindings(findings)).toBe(98);
  });

  it("returns correct score for mixed findings", () => {
    const findings = [
      makeFinding({ id: "f1", severity: "critical" }),
      makeFinding({ id: "f2", severity: "major" }),
      makeFinding({ id: "f3", severity: "minor" }),
    ];
    // W = 10 + 4 + 1 = 15 -> round(100 * exp(-15/40)) = 69
    expect(scoreFromFindings(findings)).toBe(69);
  });

  it("score is strictly monotonic: more findings always lowers it", () => {
    const base = [makeFinding({ id: "f1", severity: "critical" })];
    const more = [...base, makeFinding({ id: "f2", severity: "minor" })];
    expect(scoreFromFindings(more)).toBeLessThan(scoreFromFindings(base));
  });

  it("is strictly monotonic for the first 14 criticals (integer values are still distinct)", () => {
    // Beyond ~14 criticals the rounded integers plateau at 2, then 1, before approaching 0.
    // The underlying float is always strictly decreasing; this test covers the integer-distinct range.
    for (let n = 1; n <= 13; n++) {
      const findings = Array.from({ length: n }, (_, i) =>
        makeFinding({ id: `f${String(i)}`, severity: "critical" }),
      );
      const next = Array.from({ length: n + 1 }, (_, i) =>
        makeFinding({ id: `f${String(i)}`, severity: "critical" }),
      );
      expect(scoreFromFindings(next)).toBeLessThan(scoreFromFindings(findings));
    }
  });

  it("still scores above 0 at 20 criticals (no hard clamp in the model)", () => {
    // W=200 -> round(100 * exp(-5)) = 1. The model asymptotes, not floors.
    const findings = Array.from({ length: 20 }, (_, i) =>
      makeFinding({ id: `f${String(i)}`, severity: "critical" }),
    );
    expect(scoreFromFindings(findings)).toBeGreaterThan(0);
  });

  it("returns 8 for ten critical findings (no floor clamp)", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ id: `f${String(i)}`, severity: "critical" }),
    );
    // W = 100 -> round(100 * exp(-100/40)) = 8
    expect(scoreFromFindings(findings)).toBe(8);
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

  it("computes page score from all findings, not from the category mean", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
      makeFinding({ id: "f2", category: "semantic", severity: "minor" }),
    ]);

    // Page score: all findings -> W=11 -> round(100*exp(-11/40)) = 76
    // (old model would have averaged category scores and produced a different result)
    const scored = scorePage(original, ["a11y", "semantic"]);
    expect(scored.score).toBe(76);

    const a11yCat = scored.categories.find((c) => c.category === "a11y");
    expect(a11yCat?.status).toBe("ok");
    expect(a11yCat?.critical_count).toBe(1);
    // Category score uses only that category's findings: 1 critical -> W=10 -> 78
    expect(a11yCat?.score).toBe(78);

    const semanticCat = scored.categories.find((c) => c.category === "semantic");
    expect(semanticCat?.status).toBe("ok");
    expect(semanticCat?.minor_count).toBe(1);
    // 1 minor -> W=1 -> 98
    expect(semanticCat?.score).toBe(98);
  });

  it("page score equals scoreFromFindings over all page findings when all 4 categories run", () => {
    const findings = [
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
      makeFinding({ id: "f2", category: "semantic", severity: "minor" }),
    ];
    const original = makePageResult(findings);

    const scored = scorePage(original);

    expect(scored.score).toBe(scoreFromFindings(findings));
  });

  it("a page with one critical scores below 80 regardless of how many clean categories ran", () => {
    const original = makePageResult([
      makeFinding({ id: "f1", category: "a11y", severity: "critical" }),
    ]);

    // All four categories requested; only a11y has a finding.
    // Old model would have averaged in 3 perfect category scores and softened the result.
    const scored = scorePage(original);
    expect(scored.score).toBeLessThan(80);
    // Specifically: W=10 -> 78
    expect(scored.score).toBe(78);
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

    const semanticCat = scored.categories.find((c) => c.category === "semantic");
    expect(semanticCat?.status).toBe("ok");
    expect(semanticCat?.score).toBe(100);

    // Page score: no findings, at least one ok category -> scoreFromFindings([]) = 100
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
