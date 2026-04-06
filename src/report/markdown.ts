import type {
  AuditReport,
  CategorySummary,
  CheckCategory,
  Finding,
  Fix,
  PerformanceMetrics,
} from "../types/index.js";

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  perf: "Performance",
  a11y: "Accessibility",
  semantic: "Semantic HTML",
  bundle: "Bundle",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

function formatMs(ms: number): string {
  return `${ms.toLocaleString("en-US")}ms`;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function renderTitle(report: AuditReport): string {
  const page = report.pages[0];
  const url = page ? page.url : "unknown";
  const date = page ? page.audited_at : new Date().toISOString();
  const durationSec = (report.meta.duration_ms / 1000).toFixed(1);

  return [
    "# Foxhole Audit Report",
    "",
    `**URL:** ${url}`,
    `**Audited:** ${date}`,
    `**Duration:** ${durationSec}s`,
    "",
  ].join("\n");
}

function renderSummary(report: AuditReport): string {
  return ["## Summary", "", report.summary, ""].join("\n");
}

function renderScore(report: AuditReport): string {
  const threshold = report.meta.threshold;
  let status: string;

  if (threshold === null) {
    status = report.meta.passed ? "Pass" : "Fail";
  } else {
    status = report.meta.passed ? "Pass" : `Below threshold (${String(threshold)})`;
  }

  return ["## Score", "", `**${String(report.score)} / 100** - ${status}`, ""].join("\n");
}

function renderCategories(categories: CategorySummary[]): string {
  if (categories.length === 0) return "";

  const lines = [
    "## Categories",
    "",
    "| Category | Score | Critical | Major | Minor |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const cat of categories) {
    lines.push(
      `| ${CATEGORY_LABELS[cat.category]} | ${String(cat.score)} | ${String(cat.critical_count)} | ${String(cat.major_count)} | ${String(cat.minor_count)} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderFixes(fixes: Fix[]): string {
  if (fixes.length === 0) return "";

  const lines = ["## Prioritized fixes", ""];

  for (const fix of fixes) {
    lines.push(
      `### ${String(fix.rank)}. ${fix.title}`,
      "",
      `**Effort:** ${fix.effort.charAt(0).toUpperCase()}${fix.effort.slice(1)} | **Severity:** ${fix.severity.charAt(0).toUpperCase()}${fix.severity.slice(1)} | **Category:** ${CATEGORY_LABELS[fix.category]}`,
      "",
      fix.description,
      "",
      `Resolves: ${fix.finding_ids.join(", ")}`,
      "",
      "---",
      "",
    );
  }

  return lines.join("\n");
}

function renderFindings(findings: Finding[]): string {
  if (findings.length === 0) return "";

  const lines = ["## Findings", ""];

  const byCategory = new Map<CheckCategory, Finding[]>();
  for (const finding of findings) {
    const existing = byCategory.get(finding.category);
    if (existing) {
      existing.push(finding);
    } else {
      byCategory.set(finding.category, [finding]);
    }
  }

  for (const [category, catFindings] of byCategory) {
    lines.push(`### ${CATEGORY_LABELS[category]}`, "");

    const sorted = [...catFindings].sort(
      (a: Finding, b: Finding) =>
        (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
    );

    for (const finding of sorted) {
      lines.push(
        `#### [${finding.severity.charAt(0).toUpperCase()}${finding.severity.slice(1)}] ${finding.title}`,
        "",
      );

      if (finding.selector) {
        lines.push(`**Selector:** \`${finding.selector}\``);
      }
      if (finding.wcag) {
        lines.push(`**WCAG:** ${finding.wcag}`);
      }
      lines.push(`**Recommendation:** ${finding.recommendation}`, "", "---", "");
    }
  }

  return lines.join("\n");
}

function renderMetrics(metrics: PerformanceMetrics): string {
  const lines = [
    "## Performance metrics",
    "",
    "| Metric | Value |",
    "| --- | --- |",
  ];

  if (metrics.lcp !== null) lines.push(`| LCP | ${formatMs(metrics.lcp)} |`);
  if (metrics.fcp !== null) lines.push(`| FCP | ${formatMs(metrics.fcp)} |`);
  if (metrics.tbt !== null) lines.push(`| TBT | ${formatMs(metrics.tbt)} |`);
  if (metrics.cls !== null) lines.push(`| CLS | ${String(metrics.cls)} |`);
  if (metrics.ttfb !== null) lines.push(`| TTFB | ${formatMs(metrics.ttfb)} |`);
  if (metrics.performance_score !== null)
    lines.push(`| Performance score | ${String(metrics.performance_score)} |`);
  if (metrics.bundle_size !== null)
    lines.push(`| Bundle size | ${formatKb(metrics.bundle_size)} |`);

  lines.push("");
  return lines.join("\n");
}

function renderMeta(report: AuditReport): string {
  const lines = [
    "## Run details",
    "",
    "| | |",
    "| --- | --- |",
    `| Foxhole version | ${report.meta.foxhole_version} |`,
    `| Node version | ${report.meta.node_version} |`,
    `| Platform | ${report.meta.platform} |`,
    `| Input mode | ${report.meta.input_mode} |`,
    `| Checks run | ${report.meta.checks_run.join(", ")} |`,
    `| Duration | ${report.meta.duration_ms.toLocaleString("en-US")}ms |`,
    "",
  ];

  return lines.join("\n");
}

function renderMarkdownReport(report: AuditReport): string {
  const allCategories = report.pages.flatMap((p) => p.categories);
  const allFindings = report.pages.flatMap((p) => p.findings);
  const hasPerf = report.meta.checks_run.includes("perf");
  const metrics = report.pages[0]?.metrics;

  const sections = [
    renderTitle(report),
    renderSummary(report),
    renderScore(report),
    renderCategories(allCategories),
    renderFixes(report.prioritized_fixes),
    renderFindings(allFindings),
  ];

  if (hasPerf && metrics) {
    sections.push(renderMetrics(metrics));
  }

  sections.push(renderMeta(report));

  return sections.join("\n");
}

export { renderMarkdownReport };
