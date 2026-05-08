import type { CheckCategory, CategorySummary, Finding, PageResult } from "../types/index.js";

const CRITICAL_PENALTY = 15;
const MAJOR_PENALTY = 8;
const MINOR_PENALTY = 2;

const ALL_CATEGORIES: CheckCategory[] = ["a11y", "perf", "semantic", "bundle"];

function scoreFindings(findings: Finding[]): number {
  let score = 100;

  for (const finding of findings) {
    switch (finding.severity) {
      case "critical": {
        score -= CRITICAL_PENALTY;
        break;
      }
      case "major": {
        score -= MAJOR_PENALTY;
        break;
      }
      case "minor": {
        score -= MINOR_PENALTY;
        break;
      }
    }
  }

  return Math.max(0, score);
}

function buildCategorySummary(category: CheckCategory, findings: Finding[]): CategorySummary {
  const categoryFindings = findings.filter((f) => f.category === category);
  return {
    category,
    status: "ok",
    error: null,
    score: scoreFindings(categoryFindings),
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
): PageResult {
  const erroredByCategory = new Map<CheckCategory, CategorySummary>(
    pageResult.categories.filter((c) => c.status === "errored").map((c) => [c.category, c]),
  );

  const categories: CategorySummary[] = ALL_CATEGORIES.map((cat) => {
    const errored = erroredByCategory.get(cat);
    if (errored !== undefined) return errored;
    if (!requestedChecks.includes(cat)) return buildSkippedCategorySummary(cat);
    return buildCategorySummary(cat, pageResult.findings);
  });

  const okScores = categories.filter((c) => c.status === "ok").map((c) => c.score);
  const score =
    okScores.length > 0 ? Math.round(okScores.reduce((sum, s) => sum + s, 0) / okScores.length) : 0;

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

export { scoreFindings, scorePage, scoreReport };
