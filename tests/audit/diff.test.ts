import { describe, it, expect } from "vitest";

import { diffReports } from "../../src/audit/diff.js";
import type {
  AuditReport,
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

function basePage(overrides: Partial<PageResult> = {}): PageResult {
  return {
    url: "https://example.com",
    status: "ok",
    error: null,
    score: 80,
    categories: [],
    findings: [],
    metrics: emptyMetrics(),
    audited_at: "2026-04-07T00:00:00.000Z",
    duration_ms: 0,
    ...overrides,
  };
}

function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    version: 1,
    summary: "Test report.",
    score: 80,
    pages: [basePage()],
    prioritized_fixes: [],
    meta: {
      foxhole_version: "0.1.0",
      node_version: "v20.11.0",
      platform: "darwin-arm64",
      audited_at: "2026-04-07T00:00:00.000Z",
      input_mode: "url",
      checks_run: ["a11y"],
      page_count: 1,
      duration_ms: 1000,
      threshold: null,
      passed: true,
      concurrency: 1,
      perf_runs: 1,
      perf_profile: "none",
      source_maps: "auto",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
    ...overrides,
  };
}

describe("diffReports", () => {
  it("returns correct score_delta", () => {
    const before = makeReport({ score: 70 });
    const after = makeReport({ score: 85 });
    const diff = diffReports(before, after);
    expect(diff.score_delta).toBe(15);
  });

  it("identifies regressions (findings in after not in before)", () => {
    const before = makeReport();
    const after = makeReport({
      pages: [basePage({ findings: [makeFinding({ id: "new-issue" })] })],
    });

    const diff = diffReports(before, after);
    expect(diff.regressions).toHaveLength(1);
    expect(diff.regressions[0]?.id).toBe("new-issue");
  });

  it("identifies improvements (findings in before not in after)", () => {
    const before = makeReport({
      pages: [basePage({ findings: [makeFinding({ id: "fixed-issue" })] })],
    });
    const after = makeReport();

    const diff = diffReports(before, after);
    expect(diff.improvements).toHaveLength(1);
    expect(diff.improvements[0]?.id).toBe("fixed-issue");
  });

  it("identifies unchanged findings", () => {
    const shared = makeFinding({ id: "stable-issue" });
    const before = makeReport({ pages: [basePage({ findings: [shared] })] });
    const after = makeReport({ pages: [basePage({ findings: [shared] })] });

    const diff = diffReports(before, after);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.unchanged[0]?.id).toBe("stable-issue");
  });

  it("computes metrics_delta for fields where both values are non-null", () => {
    const before = makeReport({
      pages: [basePage({ metrics: { ...emptyMetrics(), lcp: 3000, fcp: 1500 } })],
    });
    const after = makeReport({
      pages: [basePage({ metrics: { ...emptyMetrics(), lcp: 2500, fcp: 1200 } })],
    });

    const diff = diffReports(before, after);
    expect(diff.metrics_delta.lcp).toBe(-500);
    expect(diff.metrics_delta.fcp).toBe(-300);
  });

  it("skips metrics_delta for fields where either value is null", () => {
    const before = makeReport({
      pages: [basePage({ metrics: { ...emptyMetrics(), lcp: 3000, cls: null } })],
    });
    const after = makeReport({
      pages: [basePage({ metrics: { ...emptyMetrics(), lcp: 2500, cls: 0.1 } })],
    });

    const diff = diffReports(before, after);
    expect(diff.metrics_delta.lcp).toBe(-500);
    expect(diff.metrics_delta.cls).toBeUndefined();
  });

  it("returns a non-empty summary string", () => {
    const before = makeReport({ score: 70 });
    const after = makeReport({ score: 85 });
    const diff = diffReports(before, after);
    expect(diff.summary.length).toBeGreaterThan(0);
    expect(diff.summary).toContain("+15");
  });

  it("is comparable when perf_profile and dependency major versions match", () => {
    const before = makeReport();
    const after = makeReport();
    const diff = diffReports(before, after);
    expect(diff.comparable).toBe(true);
    expect(diff.comparability_notes).toHaveLength(0);
  });

  it("is not comparable when perf_profile differs", () => {
    const before = makeReport();
    const after = makeReport({ meta: { ...makeReport().meta, perf_profile: "mobile" } });
    const diff = diffReports(before, after);
    expect(diff.comparable).toBe(false);
    expect(diff.comparability_notes).toHaveLength(1);
    expect(diff.comparability_notes[0]).toContain("none");
    expect(diff.comparability_notes[0]).toContain("mobile");
  });

  it("is not comparable when a dependency major version changes", () => {
    const before = makeReport({
      meta: {
        ...makeReport().meta,
        dependencies: { axe_core: "4.7.0", lighthouse: "10.0.0", playwright: "1.40.0" },
      },
    });
    const after = makeReport({
      meta: {
        ...makeReport().meta,
        dependencies: { axe_core: "5.0.0", lighthouse: "10.0.0", playwright: "1.40.0" },
      },
    });
    const diff = diffReports(before, after);
    expect(diff.comparable).toBe(false);
    expect(diff.comparability_notes).toHaveLength(1);
    expect(diff.comparability_notes[0]).toContain("axe_core");
    expect(diff.comparability_notes[0]).toContain("4");
    expect(diff.comparability_notes[0]).toContain("5");
  });

  it("accumulates multiple comparability notes", () => {
    const before = makeReport({
      meta: {
        ...makeReport().meta,
        perf_profile: "desktop",
        dependencies: { axe_core: "4.7.0", lighthouse: "10.0.0", playwright: "1.40.0" },
      },
    });
    const after = makeReport({
      meta: {
        ...makeReport().meta,
        perf_profile: "mobile",
        dependencies: { axe_core: "5.0.0", lighthouse: "10.0.0", playwright: "1.40.0" },
      },
    });
    const diff = diffReports(before, after);
    expect(diff.comparable).toBe(false);
    expect(diff.comparability_notes.length).toBeGreaterThanOrEqual(2);
  });

  it("remains comparable when only patch versions differ", () => {
    const before = makeReport({
      meta: {
        ...makeReport().meta,
        dependencies: { axe_core: "4.7.0", lighthouse: "10.0.1", playwright: "1.40.0" },
      },
    });
    const after = makeReport({
      meta: {
        ...makeReport().meta,
        dependencies: { axe_core: "4.8.0", lighthouse: "10.1.0", playwright: "1.41.0" },
      },
    });
    const diff = diffReports(before, after);
    expect(diff.comparable).toBe(true);
    expect(diff.comparability_notes).toHaveLength(0);
  });
});
