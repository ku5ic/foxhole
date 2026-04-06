import type { AuditReport, Finding, PerformanceMetrics, RunDiff } from "../types/index.js";

function collectFindings(report: AuditReport): Map<string, Finding> {
  const map = new Map<string, Finding>();
  for (const page of report.pages) {
    for (const finding of page.findings) {
      map.set(finding.id, finding);
    }
  }
  return map;
}

function computeMetricsDelta(
  before: PerformanceMetrics,
  after: PerformanceMetrics,
): Partial<PerformanceMetrics> {
  const delta: Partial<PerformanceMetrics> = {};
  const keys: (keyof PerformanceMetrics)[] = [
    "lcp",
    "fid",
    "cls",
    "fcp",
    "ttfb",
    "tbt",
    "performance_score",
    "accessibility_score",
    "bundle_size",
  ];

  for (const key of keys) {
    const beforeVal = before[key];
    const afterVal = after[key];
    if (beforeVal !== null && afterVal !== null) {
      (delta as Record<string, number>)[key] = afterVal - beforeVal;
    }
  }

  return delta;
}

function averageMetrics(report: AuditReport): PerformanceMetrics {
  if (report.pages.length === 0) {
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
  // Use the first page metrics for simplicity in diff
  return report.pages[0]?.metrics ?? {
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

function diffReports(before: AuditReport, after: AuditReport): RunDiff {
  const scoreDelta = after.score - before.score;
  const beforeFindings = collectFindings(before);
  const afterFindings = collectFindings(after);

  const regressions: Finding[] = [];
  const improvements: Finding[] = [];
  const unchanged: Finding[] = [];

  for (const [id, finding] of afterFindings) {
    if (beforeFindings.has(id)) {
      unchanged.push(finding);
    } else {
      regressions.push(finding);
    }
  }

  for (const [id, finding] of beforeFindings) {
    if (!afterFindings.has(id)) {
      improvements.push(finding);
    }
  }

  const metricsDelta = computeMetricsDelta(
    averageMetrics(before),
    averageMetrics(after),
  );

  const parts: string[] = [
    `Score changed by ${scoreDelta >= 0 ? "+" : ""}${String(scoreDelta)} points (${String(before.score)} -> ${String(after.score)}).`,
  ];

  if (regressions.length > 0) {
    parts.push(`${String(regressions.length)} new ${regressions.length === 1 ? "issue" : "issues"} found.`);
  }

  if (improvements.length > 0) {
    parts.push(`${String(improvements.length)} ${improvements.length === 1 ? "issue" : "issues"} resolved.`);
  }

  if (regressions.length === 0 && improvements.length === 0) {
    parts.push("No changes in findings.");
  }

  return {
    score_delta: scoreDelta,
    passed: after.meta.passed,
    regressions,
    improvements,
    unchanged,
    metrics_delta: metricsDelta,
    summary: parts.join(" "),
  };
}

export { diffReports };
