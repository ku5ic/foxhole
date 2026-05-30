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

function sanitizeMarkdownText(text: string): string {
  // Escape backticks to prevent them from opening/closing inline code spans inside prose.
  return text.replaceAll("`", "\\`");
}

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
  // Only show Pass/Fail when a threshold is configured; without one there is no pass/fail concept.
  let statusLabel: string | null = null;
  if (threshold !== null) {
    statusLabel = report.meta.passed ? "Pass" : `Below threshold (${String(threshold)})`;
  }

  const scoreLine =
    statusLabel === null
      ? `**${String(report.score)} / 100**`
      : `**${String(report.score)} / 100** - ${statusLabel}`;

  const lines = ["## Score", "", scoreLine];

  const firstMetrics = report.pages[0]?.metrics;
  if (
    report.meta.checks_run.includes("perf") &&
    firstMetrics?.performance_score !== null &&
    firstMetrics?.performance_score !== undefined
  ) {
    lines.push(`Lighthouse performance score: ${String(firstMetrics.performance_score)}.`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderCategories(categories: CategorySummary[]): string {
  const renderable = categories.filter((c) => c.status !== "skipped");
  if (renderable.length === 0) return "";

  const lines = [
    "## Categories",
    "",
    "| Category | Score | Critical | Major | Minor |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const cat of renderable) {
    if (cat.status === "errored") {
      lines.push(`| ${CATEGORY_LABELS[cat.category]} | errored | - | - | - |`);
    } else {
      lines.push(
        `| ${CATEGORY_LABELS[cat.category]} | ${String(cat.score)} | ${String(cat.critical_count)} | ${String(cat.major_count)} | ${String(cat.minor_count)} |`,
      );
    }
  }

  const erroredEntries = renderable.filter(
    (c): c is CategorySummary & { error: { message: string } } =>
      c.status === "errored" && c.error !== null,
  );
  if (erroredEntries.length > 0) {
    lines.push("", "**Errors:**", "");
    for (const cat of erroredEntries) {
      lines.push(`- ${CATEGORY_LABELS[cat.category]}: ${cat.error.message}`);
    }
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
        `#### [${finding.severity.charAt(0).toUpperCase()}${finding.severity.slice(1)}] ${sanitizeMarkdownText(finding.title)}`,
        "",
      );

      if (finding.selector) {
        lines.push(`**Selector:** \`${finding.selector}\``);
      }
      if (finding.wcag) {
        lines.push(`**WCAG:** ${finding.wcag}`);
      }
      if (finding.source) {
        const loc = `${finding.source.file}:${String(finding.source.line)}:${String(finding.source.column)}`;
        lines.push(`**Source:** ${loc}`);
      }
      lines.push(
        `**Recommendation:** ${sanitizeMarkdownText(finding.recommendation)}`,
        "",
        "---",
        "",
      );
    }
  }

  return lines.join("\n");
}

function renderMetrics(metrics: PerformanceMetrics): string {
  const lines = ["## Performance metrics", "", "| Metric | Value |", "| --- | --- |"];

  if (metrics.lcp !== null) lines.push(`| LCP | ${formatMs(metrics.lcp)} |`);
  if (metrics.fid !== null) lines.push(`| FID | ${formatMs(metrics.fid)} |`);
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
  const firstPage = report.pages[0];

  const sections = [
    renderTitle(report),
    renderSummary(report),
    renderScore(report),
    renderCategories(allCategories),
    renderFixes(report.prioritized_fixes),
    renderFindings(allFindings),
  ];

  if (hasPerf && firstPage) {
    sections.push(renderMetrics(firstPage.metrics));
  }

  sections.push(renderMeta(report));

  return sections.join("\n");
}

export { renderMarkdownReport };
