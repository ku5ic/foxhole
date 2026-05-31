import { runAudit } from "../runner/index.js";
import type { ThrottlingPreset } from "../runner/index.js";
import { scorePage, scoreReport } from "./score.js";
import type { ScorePageOptions } from "./score.js";
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
  excludeFramework?: boolean;
}

async function buildAuditReport(options: BuildAuditOptions): Promise<AuditReport> {
  const normalizedUrls = options.urls.map((url) => validateUrl(url));
  const excludeFramework = options.excludeFramework ?? false;

  const startTime = Date.now();

  const rawPages = await runAudit({
    urls: normalizedUrls,
    checks: options.checks,
    quiet: options.quiet,
    throttling: options.throttling,
    concurrency: options.concurrency,
  });

  const scoreOptions: ScorePageOptions = { excludeFramework };
  const scoredPages = rawPages.map((page) => scorePage(page, options.checks, scoreOptions));
  const overallScore = scoreReport(scoredPages);

  const allFindings = scoredPages.flatMap((page) => page.findings);
  const prioritizedFixes = prioritizeFindings(allFindings);

  const durationMs = Date.now() - startTime;
  const passed = options.threshold === undefined ? true : overallScore >= options.threshold;
  const summary = summarizeReport(scoredPages, overallScore, passed, excludeFramework);

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
      page_count: normalizedUrls.length,
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
