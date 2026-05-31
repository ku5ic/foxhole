import { runAudit } from "../runner/index.js";
import type { ThrottlingPreset } from "../runner/index.js";
import { scorePage, scoreReport } from "./score.js";
import { prioritizeFindings } from "./prioritize.js";
import { summarizeReport } from "./summarize.js";
import { validateUrl } from "../config/validate.js";
import { readFoxholeVersion, readDependencyVersion } from "../version.js";
import type { AuditReport, CheckCategory, InputMode } from "../types/index.js";

interface BuildAuditOptions {
  urls: string[];
  checks: CheckCategory[];
  quiet: boolean;
  threshold?: number | undefined;
  throttling: ThrottlingPreset;
  inputMode: InputMode;
  concurrency: number;
  perfRuns: number;
  sourceMaps: "auto" | "on" | "off";
}

async function buildAuditReport(options: BuildAuditOptions): Promise<AuditReport> {
  for (const url of options.urls) {
    validateUrl(url);
  }

  const startTime = Date.now();

  const rawPages = await runAudit({
    urls: options.urls,
    checks: options.checks,
    quiet: options.quiet,
    throttling: options.throttling,
  });

  const scoredPages = rawPages.map((page) => scorePage(page, options.checks));
  const overallScore = scoreReport(scoredPages);

  const allFindings = scoredPages.flatMap((page) => page.findings);
  const prioritizedFixes = prioritizeFindings(allFindings);

  const durationMs = Date.now() - startTime;
  const passed = options.threshold === undefined ? true : overallScore >= options.threshold;
  const summary = summarizeReport(scoredPages, overallScore, passed);

  return {
    version: 1,
    summary,
    score: overallScore,
    pages: scoredPages,
    prioritized_fixes: prioritizedFixes,
    meta: {
      foxhole_version: readFoxholeVersion(),
      node_version: process.version,
      platform: `${process.platform}-${process.arch}`,
      audited_at: new Date(startTime).toISOString(),
      input_mode: options.inputMode,
      checks_run: options.checks,
      page_count: options.urls.length,
      duration_ms: durationMs,
      threshold: options.threshold ?? null,
      passed,
      concurrency: options.concurrency,
      perf_runs: options.perfRuns,
      perf_profile: options.throttling,
      source_maps: options.sourceMaps,
      dependencies: {
        axe_core: readDependencyVersion("axe-core"),
        lighthouse: readDependencyVersion("lighthouse"),
        playwright: readDependencyVersion("playwright"),
      },
    },
  };
}

export { buildAuditReport };
export type { BuildAuditOptions };
