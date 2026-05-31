import { describe, it, expect } from "vitest";

import { summarizeReport } from "../../src/audit/summarize.js";
import type { Finding, PageResult, PerformanceMetrics } from "../../src/types/index.js";

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

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    category: "a11y",
    severity: "minor",
    effort: "low",
    rule_id: "a11y/test",
    title: "Test",
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

function makePage(findings: Finding[]): PageResult {
  return {
    url: "https://example.com",
    status: "ok",
    error: null,
    score: 100,
    categories: [],
    findings,
    metrics: emptyMetrics(),
    audited_at: "2026-04-07T00:00:00.000Z",
    duration_ms: 0,
  };
}

describe("summarizeReport", () => {
  it("mentions page count and score", () => {
    const summary = summarizeReport([makePage([])], 100, true);
    expect(summary).toContain("1 page");
    expect(summary).toContain("100 out of 100");
  });

  it("says 'No issues were found' when there are no findings", () => {
    const summary = summarizeReport([makePage([])], 100, true);
    expect(summary).toContain("No issues were found");
  });

  it("includes finding counts when findings exist", () => {
    const findings = [
      makeFinding({ id: "f1", severity: "critical" }),
      makeFinding({ id: "f2", severity: "major" }),
      makeFinding({ id: "f3", severity: "minor" }),
    ];
    const summary = summarizeReport([makePage(findings)], 70, false);
    expect(summary).toContain("3 issues");
    expect(summary).toContain("1 critical");
    expect(summary).toContain("1 major");
    expect(summary).toContain("1 minor");
  });

  it("includes critical-issue sentence when criticals exist", () => {
    const findings = [makeFinding({ id: "f1", severity: "critical" })];
    const summary = summarizeReport([makePage(findings)], 78, false);
    expect(summary).toContain("1 critical");
    expect(summary).toContain("immediate attention");
  });

  it("says 'passes the configured threshold' when passed=true and no criticals", () => {
    const findings = [makeFinding({ id: "f1", severity: "minor" })];
    const summary = summarizeReport([makePage(findings)], 90, true);
    expect(summary).toContain("passes the configured threshold");
  });

  it("omits the threshold sentence when passed=false and no criticals", () => {
    const findings = [makeFinding({ id: "f1", severity: "major" })];
    const summary = summarizeReport([makePage(findings)], 70, false);
    expect(summary).not.toContain("passes the configured threshold");
    expect(summary).not.toContain("immediate attention");
  });

  it("omits the threshold sentence when passed=false due to score (not criticals)", () => {
    // Majors only, score below threshold -- the old model would have lied here.
    const findings = [
      makeFinding({ id: "f1", severity: "major" }),
      makeFinding({ id: "f2", severity: "major" }),
    ];
    const summary = summarizeReport([makePage(findings)], 82, false);
    expect(summary).not.toContain("passes the configured threshold");
  });

  it("includes an error count when categories errored", () => {
    const page: PageResult = {
      ...makePage([]),
      categories: [
        {
          category: "a11y",
          status: "errored",
          error: { message: "axe crashed" },
          score: 0,
          findings_count: 0,
          critical_count: 0,
          major_count: 0,
          minor_count: 0,
        },
      ],
    };
    const summary = summarizeReport([page], 100, true);
    expect(summary).toContain("1 check runner error");
  });
});
