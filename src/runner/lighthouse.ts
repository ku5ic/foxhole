import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

import { catalog } from "../catalog/index.js";
import { RunnerError } from "../errors.js";
import { buildTextFingerprint, computeFindingId } from "./finding-id.js";
import type { Finding, PerformanceMetrics, Severity } from "../types/index.js";

interface LighthouseRunnerResult {
  metrics: PerformanceMetrics;
  findings: Finding[];
}

interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
}

interface LighthouseCategory {
  score: number | null;
  auditRefs: { id: string }[];
}

// Build a map from audit id to Lighthouse category id by walking lhr.categories[*].auditRefs.
function buildAuditCategoryMap(
  categories: Record<string, LighthouseCategory>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [categoryId, category] of Object.entries(categories)) {
    for (const ref of category.auditRefs) {
      map.set(ref.id, categoryId);
    }
  }
  return map;
}

function extractMetrics(
  audits: Record<string, LighthouseAudit>,
  categories: Record<string, { score: number | null }>,
): PerformanceMetrics {
  return {
    lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
    fid: audits["max-potential-fid"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    ttfb: audits["server-response-time"]?.numericValue ?? null,
    tbt: audits["total-blocking-time"]?.numericValue ?? null,
    performance_score:
      categories.performance?.score == null ? null : Math.round(categories.performance.score * 100),
    accessibility_score:
      categories.accessibility?.score == null
        ? null
        : Math.round(categories.accessibility.score * 100),
    bundle_size: null,
  };
}

function mapLighthouseAuditToFinding(audit: LighthouseAudit, pageUrl: string): Finding | null {
  // Only binary and numeric audits are pass/fail signals. notApplicable, informative,
  // manual, and metricSavings have null scores that do not indicate failure (ADR-009).
  const { scoreDisplayMode } = audit;
  if (scoreDisplayMode !== "binary" && scoreDisplayMode !== "numeric") return null;

  // Passing audits are not findings per the finding-normalization skill.
  if (audit.score !== null && audit.score >= 0.9) return null;

  const ruleId = `perf/${audit.id}`;
  const entry = catalog[ruleId];

  if (!entry && process.env.FOXHOLE_DEBUG === "1") {
    process.stderr.write(`[foxhole:debug] catalog gap: ruleId=${ruleId}\n`);
  }

  let severity: Severity;
  if (entry) {
    severity = entry.default_severity;
  } else if (audit.score === null || audit.score < 0.5) {
    severity = "critical";
  } else {
    severity = "major";
  }

  const effort = entry ? entry.default_effort : ("medium" as const);
  const title = entry ? entry.title_template : audit.title;
  const description = entry ? entry.description_template : audit.description;
  const recommendation = entry
    ? entry.recommendation
    : `Review this audit in the Lighthouse documentation: ${audit.id}`;

  const textFingerprint = buildTextFingerprint({
    ruleId: audit.id,
    detail: audit.displayValue ?? audit.title,
  });
  const id = computeFindingId({ pageUrl, ruleId, semanticPath: "", textFingerprint });

  return {
    id,
    category: "perf",
    severity,
    effort,
    rule_id: ruleId,
    title,
    description,
    recommendation,
    selector: null,
    wcag: null,
    impact: null,
    source: null,
    url: pageUrl,
  };
}

// Lighthouse spawns its own Chrome instance separately from the Playwright browser.
// Unifying these is deferred debt -- see architecture spec section 13.4.
async function runLighthouse(pageUrl: string): Promise<LighthouseRunnerResult> {
  let chrome;
  try {
    chrome = await launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });
  } catch (cause) {
    throw new RunnerError("Failed to launch Chrome for Lighthouse", cause);
  }

  try {
    const result = await lighthouse(pageUrl, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
    });

    if (!result?.lhr) {
      throw new RunnerError("Lighthouse returned no results");
    }

    const { lhr } = result;
    const audits = lhr.audits as Record<string, LighthouseAudit>;
    const categories = lhr.categories as Record<string, LighthouseCategory>;

    const metrics = extractMetrics(audits, categories);
    const auditCategoryMap = buildAuditCategoryMap(categories);

    const findings: Finding[] = [];
    for (const [auditId, audit] of Object.entries(audits)) {
      // Lighthouse accessibility audits are dropped: axe-core owns a11y (ADR-009).
      // Best-practices and SEO are out of scope for v1.
      if (auditCategoryMap.get(auditId) !== "performance") continue;
      const finding = mapLighthouseAuditToFinding(audit, pageUrl);
      if (finding !== null) findings.push(finding);
    }

    return { metrics, findings };
  } catch (cause) {
    if (cause instanceof RunnerError) throw cause;
    throw new RunnerError("Failed to run Lighthouse audit", cause);
  } finally {
    chrome.kill();
  }
}

export { runLighthouse, mapLighthouseAuditToFinding, extractMetrics, buildAuditCategoryMap };
export type { LighthouseRunnerResult, LighthouseAudit, LighthouseCategory };
