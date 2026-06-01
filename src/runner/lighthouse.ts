import lighthouse from "lighthouse";
import { z } from "zod";

import { RunnerError } from "../errors.js";
import { catalogLookup } from "./catalog-lookup.js";
import { buildTextFingerprint } from "./finding-id.js";
import { makeFinding } from "./make-finding.js";
import type { Finding, PerformanceMetrics, Severity, ThrottlingPreset } from "../types/index.js";

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

// Throttling values sourced from lighthouse/core/config/constants.js at lighthouse@13.1.0.
// desktopDense4G: 40ms RTT, 10 Mbps, 1x CPU -- desktop conditions, light simulation.
const DESKTOP_THROTTLING = {
  rttMs: 40,
  throughputKbps: 10_240,
  cpuSlowdownMultiplier: 1,
  requestLatencyMs: 0,
  downloadThroughputKbps: 0,
  uploadThroughputKbps: 0,
};
// mobileSlow4G: 150ms RTT, 1.6 Mbps, 4x CPU -- matches PageSpeed Insights default.
const MOBILE_THROTTLING = {
  rttMs: 150,
  throughputKbps: 1638.4,
  requestLatencyMs: 562.5,
  downloadThroughputKbps: 1474.56,
  uploadThroughputKbps: 675,
  cpuSlowdownMultiplier: 4,
};
// "provided" preset passes zero throttling; the runner reports observed conditions as-is.
const NO_THROTTLING = {
  rttMs: 0,
  throughputKbps: 0,
  cpuSlowdownMultiplier: 1,
  requestLatencyMs: 0,
  downloadThroughputKbps: 0,
  uploadThroughputKbps: 0,
};

// Screen emulation values from lighthouse/core/config/constants.js screenEmulationMetrics.
const DESKTOP_SCREEN = {
  mobile: false,
  width: 1350,
  height: 940,
  deviceScaleFactor: 1,
  disabled: false,
};
const MOBILE_SCREEN = {
  mobile: true,
  width: 412,
  height: 823,
  deviceScaleFactor: 1.75,
  disabled: false,
};

const lighthouseAuditEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  score: z.number().nullable(),
  scoreDisplayMode: z.string().optional(),
  displayValue: z.string().optional(),
  numericValue: z.number().optional(),
});

const lighthouseCategoryEntrySchema = z.object({
  score: z.number().nullable(),
  auditRefs: z.array(z.object({ id: z.string() })),
});

const lighthouseLhrPartsSchema = z.object({
  audits: z.record(z.string(), lighthouseAuditEntrySchema),
  categories: z.record(z.string(), lighthouseCategoryEntrySchema),
});

function parseLighthouseResults(lhr: unknown): {
  audits: Record<string, LighthouseAudit>;
  categories: Record<string, LighthouseCategory>;
} {
  const result = lighthouseLhrPartsSchema.safeParse(lhr);
  if (!result.success) {
    const issue = result.error.issues[0];
    const detail = issue ? `${issue.path.join(".") || "root"}: ${issue.message}` : "unknown";
    throw new RunnerError(`Unexpected Lighthouse result shape: ${detail}`);
  }
  // Cast is safe: the Zod schema validates the shape; the mismatch is a TypeScript
  // exactOptionalPropertyTypes artefact (Zod infers `string | undefined` for optional
  // fields, the interfaces declare only `string`).
  return result.data as {
    audits: Record<string, LighthouseAudit>;
    categories: Record<string, LighthouseCategory>;
  };
}

interface LighthousePresetSettings {
  formFactor: "desktop" | "mobile";
  throttlingMethod: "simulate" | "provided";
  throttling: typeof DESKTOP_THROTTLING;
  screenEmulation: typeof DESKTOP_SCREEN | typeof MOBILE_SCREEN;
}

// Maps a ThrottlingPreset to the Lighthouse flags fields that control form factor and throttling.
function buildLighthouseConfig(preset: ThrottlingPreset): LighthousePresetSettings {
  switch (preset) {
    case "desktop": {
      return {
        formFactor: "desktop",
        throttlingMethod: "simulate",
        throttling: DESKTOP_THROTTLING,
        screenEmulation: DESKTOP_SCREEN,
      };
    }
    case "mobile": {
      return {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        throttling: MOBILE_THROTTLING,
        screenEmulation: MOBILE_SCREEN,
      };
    }
    case "none": {
      // "provided" tells Lighthouse to treat observed timings as real -- no simulated CPU or network slowdown.
      return {
        formFactor: "desktop",
        throttlingMethod: "provided",
        throttling: NO_THROTTLING,
        screenEmulation: DESKTOP_SCREEN,
      };
    }
  }
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
    framework_bundle_size: null,
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
  const entry = catalogLookup(ruleId);

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

  // For numeric audits the displayValue changes every run (e.g. "480 ms" vs "560 ms").
  // Use the stable title so the ID does not change when the measured value shifts.
  const fingerprintDetail =
    scoreDisplayMode === "numeric" ? audit.title : (audit.displayValue ?? audit.title);
  const textFingerprint = buildTextFingerprint({
    ruleId: audit.id,
    detail: fingerprintDetail,
  });
  return makeFinding({
    category: "perf",
    ruleId,
    pageUrl,
    severity,
    effort,
    title,
    description,
    recommendation,
    textFingerprint,
  });
}

async function runLighthouse(
  pageUrl: string,
  port: number,
  throttling: ThrottlingPreset,
): Promise<LighthouseRunnerResult> {
  try {
    const presetSettings = buildLighthouseConfig(throttling);
    const result = await lighthouse(pageUrl, {
      port,
      output: "json",
      logLevel: "error",
      ...presetSettings,
    });

    if (!result?.lhr) {
      throw new RunnerError("Lighthouse returned no results");
    }

    const { lhr } = result;
    const { audits, categories } = parseLighthouseResults(lhr);

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
  }
}

export {
  runLighthouse,
  mapLighthouseAuditToFinding,
  parseLighthouseResults,
  extractMetrics,
  buildAuditCategoryMap,
  buildLighthouseConfig,
};
export type { LighthouseRunnerResult, LighthouseAudit, LighthouseCategory };
