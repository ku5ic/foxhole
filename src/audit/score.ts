import type { CheckCategory, CategorySummary, Finding, PageResult } from "../types/index.js";

const CRITICAL_PENALTY = 15;
const MAJOR_PENALTY = 8;
const MINOR_PENALTY = 2;

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

function scorePage(pageResult: PageResult): PageResult {
  const score = scoreFindings(pageResult.findings);
  const presentCategories = [...new Set(pageResult.findings.map((f) => f.category))];
  const categories = presentCategories.map((cat) => buildCategorySummary(cat, pageResult.findings));

  return {
    ...pageResult,
    score,
    categories,
  };
}

function scoreReport(pages: PageResult[]): number {
  if (pages.length === 0) return 100;
  const total = pages.reduce((sum, page) => sum + page.score, 0);
  return Math.round(total / pages.length);
}

export { scoreFindings, scorePage, scoreReport };
