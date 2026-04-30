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
      platform: "darwin",
      input_mode: "url",
      checks_run: ["a11y"],
      crawl_depth: 0,
      duration_ms: 1000,
      threshold: null,
      passed: true,
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
});
