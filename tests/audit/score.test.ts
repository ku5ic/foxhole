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
    kind: null,
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
    framework_bundle_size: null,
  };
}

function makePageResult(
  findings: Finding[],
  metricsOverrides: Partial<PerformanceMetrics> = {},
): PageResult {
  return {
    url: "https://example.com",
    status: "ok",
    error: null,
    score: 0,
    categories: [],
    findings,
    metrics: { ...emptyMetrics(), ...metricsOverrides },
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

  describe("excludeFramework option", () => {
    const OVER_THRESHOLD = 600 * 1024; // 600 KB total
    const FRAMEWORK_BYTES = 450 * 1024; // 450 KB framework
    // app bytes = 600 - 450 = 150 KB, under the 500 KB threshold

    const FRAMEWORK_CHUNK_FINDING = makeFinding({
      id: "fw-chunk",
      category: "bundle",
      severity: "minor",
      rule_id: "bundle/large-javascript-chunk",
      kind: "framework",
    });

    const TOTAL_JS_FINDING = makeFinding({
      id: "total-js",
      category: "bundle",
      severity: "major",
      rule_id: "bundle/total-js-size",
      kind: null,
    });

    const APP_CHUNK_FINDING = makeFinding({
      id: "app-chunk",
      category: "bundle",
      severity: "minor",
      rule_id: "bundle/large-javascript-chunk",
      kind: "application",
    });

    const A11Y_FINDING = makeFinding({
      id: "a11y-1",
      category: "a11y",
      severity: "critical",
      rule_id: "a11y/color-contrast",
    });

    it("flag off produces same result as no option (regression)", () => {
      const findings = [FRAMEWORK_CHUNK_FINDING, TOTAL_JS_FINDING, A11Y_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withOff = scorePage(page, undefined, { excludeFramework: false });
      const withDefault = scorePage(page);
      expect(withOff.score).toBe(withDefault.score);
      expect(withOff.categories).toEqual(withDefault.categories);
    });

    it("framework large-chunk finding is dropped from the score when flag is on", () => {
      const findings = [FRAMEWORK_CHUNK_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      // Framework chunk excluded -> scoring findings empty -> score 100
      expect(withFlag.score).toBe(100);
    });

    it("application large-chunk finding is retained in the score when flag is on", () => {
      const findings = [APP_CHUNK_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      // App chunk retained -> 1 minor -> 98
      expect(withFlag.score).toBe(98);
    });

    it("total-js-size finding is dropped from score when app bytes are under threshold", () => {
      // app bytes = 150 KB < 500 KB -> finding excluded from score
      const findings = [TOTAL_JS_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      expect(withFlag.score).toBe(100);
    });

    it("total-js-size finding is retained in score when app bytes still exceed threshold", () => {
      // app bytes = 600 KB - 50 KB = 550 KB, over the 500 KB threshold
      const findings = [TOTAL_JS_FINDING];
      const page = makePageResult(findings, {
        bundle_size: 600 * 1024,
        framework_bundle_size: 50 * 1024,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      // 1 major retained -> W=4 -> 90
      expect(withFlag.score).toBe(90);
    });

    it("finding counts reflect the full finding set regardless of the flag", () => {
      const findings = [FRAMEWORK_CHUNK_FINDING, TOTAL_JS_FINDING, APP_CHUNK_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      const bundleCat = withFlag.categories.find((c) => c.category === "bundle");
      // All three bundle findings still counted
      expect(bundleCat?.findings_count).toBe(3);
      expect(bundleCat?.minor_count).toBe(2);
      expect(bundleCat?.major_count).toBe(1);
    });

    it("handles null bundle_size and framework_bundle_size safely (treats as 0 bytes)", () => {
      const findings = [FRAMEWORK_CHUNK_FINDING, TOTAL_JS_FINDING];
      const page = makePageResult(findings);
      // null metrics: framework bytes = 0, total bytes = 0, app bytes = 0 <= 500 KB
      // both findings excluded from score
      expect(() => scorePage(page, undefined, { excludeFramework: true })).not.toThrow();
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      expect(withFlag.score).toBe(100);
    });

    it("non-bundle findings are never excluded regardless of the flag", () => {
      const findings = [A11Y_FINDING, FRAMEWORK_CHUNK_FINDING];
      const page = makePageResult(findings, {
        bundle_size: OVER_THRESHOLD,
        framework_bundle_size: FRAMEWORK_BYTES,
      });
      const withFlag = scorePage(page, undefined, { excludeFramework: true });
      // a11y critical retained -> W=10 -> 78
      expect(withFlag.score).toBe(78);
    });
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
