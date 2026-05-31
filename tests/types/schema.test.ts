import { describe, it, expect } from "vitest";

import {
  findingSchema,
  auditReportSchema,
  runMetaSchema,
  pageResultSchema,
  runDiffSchema,
} from "../../src/types/schema.js";

const validFinding = {
  id: "a3f9c2e1d4b68f71",
  category: "a11y" as const,
  severity: "major" as const,
  effort: "low" as const,
  rule_id: "a11y/label",
  title: "Form input missing label",
  description: "The input has no associated label.",
  recommendation: "Add a label element with a for attribute matching the input id.",
  selector: "input#email",
  wcag: "1.3.1",
  impact: "serious",
  source: null,
  kind: null,
  url: "https://example.com",
};

const validMeta = {
  foxhole_version: "0.1.0",
  node_version: "v20.11.0",
  platform: "darwin-arm64",
  audited_at: "2026-04-07T12:00:00.000Z",
  input_mode: "url" as const,
  checks_run: ["a11y"] as const,
  page_count: 1,
  duration_ms: 5000,
  threshold: null,
  passed: true,
  concurrency: 1,
  perf_runs: 1,
  perf_profile: "none" as const,
  source_maps: "auto" as const,
  dependencies: { axe_core: "4.10.0", lighthouse: "12.2.1", playwright: "1.48.0" },
};

const validPage = {
  url: "https://example.com",
  status: "ok" as const,
  error: null,
  score: 85,
  categories: [],
  findings: [validFinding],
  metrics: {
    lcp: 2400,
    fid: null,
    cls: 0.08,
    fcp: 1200,
    ttfb: 320,
    tbt: 180,
    performance_score: 85,
    accessibility_score: 72,
    bundle_size: 425_000,
  },
  audited_at: "2026-04-07T12:00:00.000Z",
  duration_ms: 6200,
};

describe("findingSchema", () => {
  it("parses a valid finding", () => {
    const result = findingSchema.safeParse(validFinding);
    expect(result.success).toBe(true);
  });

  it("rejects a finding without rule_id", () => {
    const result = findingSchema.safeParse(
      Object.fromEntries(Object.entries(validFinding).filter(([k]) => k !== "rule_id")),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a finding with invalid severity", () => {
    const result = findingSchema.safeParse({ ...validFinding, severity: "warning" });
    expect(result.success).toBe(false);
  });

  it("accepts source: null", () => {
    const result = findingSchema.safeParse({ ...validFinding, source: null });
    expect(result.success).toBe(true);
  });

  it("accepts a populated source location", () => {
    const result = findingSchema.safeParse({
      ...validFinding,
      source: { file: "/src/App.tsx", line: 12, column: 3, snippet: null },
    });
    expect(result.success).toBe(true);
  });
});

describe("runMetaSchema", () => {
  it("parses valid run meta", () => {
    const result = runMetaSchema.safeParse(validMeta);
    expect(result.success).toBe(true);
  });

  it("rejects meta with unknown extra field (strict mode)", () => {
    const result = runMetaSchema.safeParse({ ...validMeta, crawl_depth: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid perf_profile value", () => {
    const result = runMetaSchema.safeParse({ ...validMeta, perf_profile: "slow" });
    expect(result.success).toBe(false);
  });

  it("rejects deprecated perf_profile values fast and standard", () => {
    expect(runMetaSchema.safeParse({ ...validMeta, perf_profile: "fast" }).success).toBe(false);
    expect(runMetaSchema.safeParse({ ...validMeta, perf_profile: "standard" }).success).toBe(false);
  });

  it("rejects invalid source_maps value", () => {
    const result = runMetaSchema.safeParse({ ...validMeta, source_maps: "enabled" });
    expect(result.success).toBe(false);
  });
});

describe("pageResultSchema", () => {
  it("parses a valid page result", () => {
    const result = pageResultSchema.safeParse(validPage);
    expect(result.success).toBe(true);
  });

  it("rejects page result without duration_ms (strict mode)", () => {
    const result = pageResultSchema.safeParse(
      Object.fromEntries(Object.entries(validPage).filter(([k]) => k !== "duration_ms")),
    );
    expect(result.success).toBe(false);
  });

  it("rejects page result with unknown extra field (strict mode)", () => {
    const result = pageResultSchema.safeParse({ ...validPage, extra: "field" });
    expect(result.success).toBe(false);
  });
});

describe("auditReportSchema", () => {
  it("parses a valid audit report", () => {
    const report = {
      version: 1 as const,
      summary: "Test summary.",
      score: 85,
      pages: [validPage],
      prioritized_fixes: [],
      meta: validMeta,
    };
    const result = auditReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("rejects version other than 1", () => {
    const result = auditReportSchema.safeParse({
      version: 2,
      summary: "Test.",
      score: 85,
      pages: [],
      prioritized_fixes: [],
      meta: validMeta,
    });
    expect(result.success).toBe(false);
  });

  it("rejects report with extra top-level field (strict mode)", () => {
    const result = auditReportSchema.safeParse({
      version: 1,
      summary: "Test.",
      score: 85,
      pages: [],
      prioritized_fixes: [],
      meta: validMeta,
      extra: "field",
    });
    expect(result.success).toBe(false);
  });
});

describe("runDiffSchema", () => {
  const metaSnapshot = {
    foxhole_version: "0.1.0",
    audited_at: "2026-04-07T12:00:00.000Z",
    perf_profile: "none" as const,
    dependencies: { axe_core: "4.10.0", lighthouse: "12.2.1", playwright: "1.48.0" },
  };

  it("parses a valid run diff", () => {
    const diff = {
      before_meta: metaSnapshot,
      after_meta: metaSnapshot,
      comparable: true,
      comparability_notes: [],
      score_delta: 8,
      passed: true,
      regressions: [],
      improvements: [],
      unchanged: [],
      metrics_delta: { lcp: -200 },
      summary: "Score improved.",
    };
    const result = runDiffSchema.safeParse(diff);
    expect(result.success).toBe(true);
  });

  it("rejects diff with missing before_meta", () => {
    const diff = {
      after_meta: metaSnapshot,
      comparable: true,
      comparability_notes: [],
      score_delta: 0,
      passed: true,
      regressions: [],
      improvements: [],
      unchanged: [],
      metrics_delta: {},
      summary: "No change.",
    };
    const result = runDiffSchema.safeParse(diff);
    expect(result.success).toBe(false);
  });
});
