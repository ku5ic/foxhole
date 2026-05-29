import { describe, it, expect } from "vitest";

import { renderMarkdownReport } from "../../src/report/markdown.js";
import type {
  AuditReport,
  CategorySummary,
  Finding,
  PageResult,
  PerformanceMetrics,
} from "../../src/types/index.js";

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

function okCategory(overrides: Partial<CategorySummary> = {}): CategorySummary {
  return {
    category: "a11y",
    status: "ok",
    error: null,
    score: 92,
    findings_count: 1,
    critical_count: 0,
    major_count: 1,
    minor_count: 0,
    ...overrides,
  };
}

function erroredCategory(
  message: string,
  overrides: Partial<CategorySummary> = {},
): CategorySummary {
  return {
    category: "perf",
    status: "errored",
    error: { message },
    score: 0,
    findings_count: 0,
    critical_count: 0,
    major_count: 0,
    minor_count: 0,
    ...overrides,
  };
}

function skippedCategory(overrides: Partial<CategorySummary> = {}): CategorySummary {
  return {
    category: "perf",
    status: "skipped",
    error: null,
    score: 0,
    findings_count: 0,
    critical_count: 0,
    major_count: 0,
    minor_count: 0,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "abc123",
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

function makePage(categories: CategorySummary[], findings: Finding[] = []): PageResult {
  return {
    url: "https://example.com",
    status: "ok",
    error: null,
    score: 80,
    categories,
    findings,
    metrics: emptyMetrics(),
    audited_at: "2026-04-30T00:00:00.000Z",
    duration_ms: 0,
  };
}

function makeReport(pages: PageResult[]): AuditReport {
  return {
    version: 1,
    summary: "Test summary.",
    score: 80,
    pages,
    prioritized_fixes: [],
    meta: {
      foxhole_version: "test",
      node_version: "test",
      platform: "test-arm64",
      audited_at: "2026-04-30T00:00:00.000Z",
      input_mode: "url",
      checks_run: ["a11y"],
      page_count: 1,
      duration_ms: 0,
      threshold: null,
      passed: true,
      concurrency: 1,
      perf_runs: 1,
      perf_profile: "none",
      source_maps: "auto",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
  };
}

describe("renderMarkdownReport categories table", () => {
  it("renders ok categories with their numeric score and counts", () => {
    const report = makeReport([makePage([okCategory()])]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("| Accessibility | 92 | 0 | 1 | 0 |");
  });

  it("renders errored categories with 'errored' in the score column and dashes elsewhere", () => {
    const report = makeReport([makePage([erroredCategory("Failed to launch browser")])]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("| Performance | errored | - | - | - |");
  });

  it("appends an Errors list with each errored category's message", () => {
    const report = makeReport([
      makePage([
        erroredCategory("Failed to launch browser", { category: "perf" }),
        erroredCategory("Failed to run axe-core", { category: "a11y" }),
      ]),
    ]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("**Errors:**");
    expect(output).toContain("- Performance: Failed to launch browser");
    expect(output).toContain("- Accessibility: Failed to run axe-core");
  });

  it("does not render the Errors list when all categories are ok", () => {
    const report = makeReport([makePage([okCategory()])]);

    const output = renderMarkdownReport(report);

    expect(output).not.toContain("**Errors:**");
  });

  it("omits skipped categories from the table", () => {
    const report = makeReport([
      makePage([
        okCategory({ category: "a11y", score: 90 }),
        skippedCategory({ category: "perf" }),
        skippedCategory({ category: "semantic" }),
        skippedCategory({ category: "bundle" }),
      ]),
    ]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("| Accessibility | 90 |");
    expect(output).not.toContain("| Performance |");
    expect(output).not.toContain("| Semantic HTML |");
    expect(output).not.toContain("| Bundle |");
  });

  it("renders no categories section when all categories are skipped", () => {
    const report = makeReport([
      makePage([
        skippedCategory({ category: "a11y" }),
        skippedCategory({ category: "perf" }),
        skippedCategory({ category: "semantic" }),
        skippedCategory({ category: "bundle" }),
      ]),
    ]);

    const output = renderMarkdownReport(report);

    expect(output).not.toContain("## Categories");
  });

  it("renders errored categories while still omitting skipped ones", () => {
    const report = makeReport([
      makePage([
        erroredCategory("axe crashed", { category: "a11y" }),
        skippedCategory({ category: "perf" }),
        skippedCategory({ category: "semantic" }),
        skippedCategory({ category: "bundle" }),
      ]),
    ]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("| Accessibility | errored |");
    expect(output).not.toContain("| Performance |");
  });
});

describe("renderMarkdownReport findings - source location", () => {
  it("renders no source line when source is null", () => {
    const report = makeReport([makePage([okCategory()], [makeFinding({ source: null })])]);

    const output = renderMarkdownReport(report);

    expect(output).not.toContain("**Source:**");
  });

  it("renders source file, line, and column when source is non-null", () => {
    const finding = makeFinding({
      source: { file: "src/components/Button.tsx", line: 42, column: 8, snippet: null },
    });
    const report = makeReport([makePage([okCategory()], [finding])]);

    const output = renderMarkdownReport(report);

    expect(output).toContain("**Source:** src/components/Button.tsx:42:8");
  });
});
