import lighthouse from "lighthouse";

import { RunnerError } from "../errors.js";
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

function mapLighthouseScoreToSeverity(score: number | null): Severity {
  if (score === null || score < 0.5) return "critical";
  if (score < 0.9) return "major";
  return "minor";
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

function mapAuditToFinding(audit: LighthouseAudit, pageUrl: string): Finding {
  return {
    id: `perf-${audit.id}`,
    category: "perf",
    severity: mapLighthouseScoreToSeverity(audit.score),
    effort: "medium",
    title: audit.title,
    description: audit.description,
    recommendation: audit.title,
    selector: null,
    wcag: null,
    impact: null,
    url: pageUrl,
  };
}

// TODO: Lighthouse currently requires a separate Chrome instance and this should
// be unified with the Playwright browser in a later iteration
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
      if (audit.score !== null && audit.score < 0.9) {
        findings.push(mapAuditToFinding(audit, pageUrl));
      }
    }

    return { metrics, findings };
  } catch (cause) {
    if (cause instanceof RunnerError) throw cause;
    throw new RunnerError("Failed to run Lighthouse audit", cause);
  }
}

export { runLighthouse };
export type { LighthouseRunnerResult };
