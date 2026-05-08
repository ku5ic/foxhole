import lighthouse from "lighthouse";

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
  displayValue?: string;
  numericValue?: number;
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
  try {
    const result = await lighthouse(pageUrl, {
      output: "json",
      logLevel: "error",
    });

    if (!result?.lhr) {
      throw new RunnerError("Lighthouse returned no results");
    }

    const { lhr } = result;
    const audits = lhr.audits as Record<string, LighthouseAudit>;
    const categories = lhr.categories as Record<string, { score: number | null }>;

    const metrics = extractMetrics(audits, categories);

    const findings: Finding[] = [];
    for (const audit of Object.values(audits)) {
      const finding = mapLighthouseAuditToFinding(audit, pageUrl);
      if (finding !== null) findings.push(finding);
    }

    return { metrics, findings };
  } catch (cause) {
    if (cause instanceof RunnerError) throw cause;
    throw new RunnerError("Failed to run Lighthouse audit", cause);
  }
}

export { runLighthouse, mapLighthouseAuditToFinding, extractMetrics };
export type { LighthouseRunnerResult, LighthouseAudit };
