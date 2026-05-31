import type { AuditReport, Finding, PerformanceMetrics, RunDiff, RunMeta } from "../types/index.js";

type RunMetaSnapshot = Pick<
  RunMeta,
  "foxhole_version" | "audited_at" | "perf_profile" | "dependencies"
>;

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
      (delta as Partial<Record<keyof PerformanceMetrics, number>>)[key] = afterVal - beforeVal;
    }
  }

  return delta;
}

function parseMajorVersion(version: string): number {
  const dotIdx = version.indexOf(".");
  const major = dotIdx === -1 ? version : version.slice(0, dotIdx);
  return Number.parseInt(major, 10);
}

function computeComparability(
  before: RunMetaSnapshot,
  after: RunMetaSnapshot,
): { comparable: boolean; notes: string[] } {
  const notes: string[] = [];

  if (before.perf_profile !== after.perf_profile) {
    notes.push(`Perf profile changed from "${before.perf_profile}" to "${after.perf_profile}".`);
  }

  const deps = ["axe_core", "lighthouse", "playwright"] as const;
  for (const dep of deps) {
    const beforeMajor = parseMajorVersion(before.dependencies[dep]);
    const afterMajor = parseMajorVersion(after.dependencies[dep]);
    if (!Number.isNaN(beforeMajor) && !Number.isNaN(afterMajor) && beforeMajor !== afterMajor) {
      notes.push(
        `${dep} major version changed from ${String(beforeMajor)} to ${String(afterMajor)}.`,
      );
    }
  }

  return { comparable: notes.length === 0, notes };
}

const NULL_METRICS: PerformanceMetrics = {
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

// Uses first-page metrics for the diff. For multi-page reports this is a simplification;
// a true average across pages is deferred until perf averaging is properly specced.
function firstPageMetrics(report: AuditReport): PerformanceMetrics {
  return report.pages[0]?.metrics ?? NULL_METRICS;
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

  const metricsDelta = computeMetricsDelta(firstPageMetrics(before), firstPageMetrics(after));

  const beforeMeta: RunMetaSnapshot = {
    foxhole_version: before.meta.foxhole_version,
    audited_at: before.meta.audited_at,
    perf_profile: before.meta.perf_profile,
    dependencies: before.meta.dependencies,
  };
  const afterMeta: RunMetaSnapshot = {
    foxhole_version: after.meta.foxhole_version,
    audited_at: after.meta.audited_at,
    perf_profile: after.meta.perf_profile,
    dependencies: after.meta.dependencies,
  };
  const { comparable, notes: comparabilityNotes } = computeComparability(beforeMeta, afterMeta);

  const parts: string[] = [
    `Score changed by ${scoreDelta >= 0 ? "+" : ""}${String(scoreDelta)} points (${String(before.score)} -> ${String(after.score)}).`,
  ];

  if (regressions.length > 0) {
    parts.push(
      `${String(regressions.length)} new ${regressions.length === 1 ? "issue" : "issues"} found.`,
    );
  }

  if (improvements.length > 0) {
    parts.push(
      `${String(improvements.length)} ${improvements.length === 1 ? "issue" : "issues"} resolved.`,
    );
  }

  if (regressions.length === 0 && improvements.length === 0) {
    parts.push("No changes in findings.");
  }

  return {
    before_meta: beforeMeta,
    after_meta: afterMeta,
    comparable,
    comparability_notes: comparabilityNotes,
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
