import { MAX_TOTAL_JS_BYTES } from "../runner/bundle.js";
import type {
  CheckCategory,
  CategorySummary,
  Finding,
  PageResult,
  PerformanceMetrics,
} from "../types/index.js";

// Severity weights for the exponential decay scoring model (see docs/decisions/ADR-010.md).
// Ratios are intentional: critical is 2.5x major and 10x minor.
const SEVERITY_WEIGHTS = {
  critical: 10,
  major: 4,
  minor: 1,
} as const;

// Decay scale: controls how steeply additional findings lower the score.
// With SCORE_SCALE=40: one critical -> 78, five criticals -> 29, ten criticals -> 8.
const SCORE_SCALE = 40;

const ALL_CATEGORIES: CheckCategory[] = ["a11y", "perf", "semantic", "bundle"];

interface ScorePageOptions {
  excludeFramework?: boolean;
}

function scoreFromFindings(findings: Finding[]): number {
  const load = findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
  return Math.round(100 * Math.exp(-load / SCORE_SCALE));
}

// Returns the subset of findings that contribute to score computation when
// --exclude-framework is on. Framework large-chunk findings are always dropped.
// The total-js-size finding (kind: null) is dropped only when application-only
// bytes do not exceed the threshold -- if they still do, the finding still counts.
function excludeFrameworkFromScoring(findings: Finding[], metrics: PerformanceMetrics): Finding[] {
  const frameworkBytes = metrics.framework_bundle_size ?? 0;
  const totalBytes = metrics.bundle_size ?? 0;
  const appBytes = totalBytes - frameworkBytes;

  return findings.filter((f) => {
    if (f.rule_id === "bundle/large-javascript-chunk" && f.kind === "framework") return false;
    if (f.rule_id === "bundle/total-js-size" && appBytes <= MAX_TOTAL_JS_BYTES) return false;
    return true;
  });
}

function buildCategorySummary(
  category: CheckCategory,
  findings: Finding[],
  scoringFindings: Finding[],
): CategorySummary {
  const categoryFindings = findings.filter((f) => f.category === category);
  const categoryScoringFindings = scoringFindings.filter((f) => f.category === category);
  return {
    category,
    status: "ok",
    error: null,
    score: scoreFromFindings(categoryScoringFindings),
    findings_count: categoryFindings.length,
    critical_count: categoryFindings.filter((f) => f.severity === "critical").length,
    major_count: categoryFindings.filter((f) => f.severity === "major").length,
    minor_count: categoryFindings.filter((f) => f.severity === "minor").length,
  };
}

function buildSkippedCategorySummary(category: CheckCategory): CategorySummary {
  return {
    category,
    status: "skipped",
    error: null,
    score: 0,
    findings_count: 0,
    critical_count: 0,
    major_count: 0,
    minor_count: 0,
  };
}

function scorePage(
  pageResult: PageResult,
  requestedChecks: CheckCategory[] = ALL_CATEGORIES,
  options: ScorePageOptions = {},
): PageResult {
  const { excludeFramework = false } = options;

  const scoringFindings = excludeFramework
    ? excludeFrameworkFromScoring(pageResult.findings, pageResult.metrics)
    : pageResult.findings;

  const erroredByCategory = new Map<CheckCategory, CategorySummary>(
    pageResult.categories.filter((c) => c.status === "errored").map((c) => [c.category, c]),
  );

  const categories: CategorySummary[] = ALL_CATEGORIES.map((cat) => {
    const errored = erroredByCategory.get(cat);
    if (errored !== undefined) return errored;
    if (!requestedChecks.includes(cat)) return buildSkippedCategorySummary(cat);
    return buildCategorySummary(cat, pageResult.findings, scoringFindings);
  });

  const hasAnyOkCategory = categories.some((c) => c.status === "ok");
  // Page score is computed from ALL findings on the page, not the mean of category scores.
  // This eliminates empty-category inflation: a page with one critical scores 78 regardless
  // of how many categories ran clean. See ADR-010.
  const score = hasAnyOkCategory ? scoreFromFindings(scoringFindings) : 0;

  return {
    ...pageResult,
    score,
    categories,
  };
}

function scoreReport(pages: PageResult[]): number {
  if (pages.length === 0) return 100;
  const okPages = pages.filter((p) => p.status === "ok");
  if (okPages.length === 0) return 0;
  const total = okPages.reduce((sum, page) => sum + page.score, 0);
  return Math.round(total / okPages.length);
}

export { scoreFromFindings, scorePage, scoreReport };
export type { ScorePageOptions };
