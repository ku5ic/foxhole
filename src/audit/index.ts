import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { runAudit } from "../runner/index.js";
import { scorePage, scoreReport } from "./score.js";
import { prioritizeFindings } from "./prioritize.js";
import { summarizeReport } from "./summarize.js";
import type { AuditReport, CheckCategory } from "../types/index.js";

interface BuildAuditOptions {
  urls: string[];
  checks: CheckCategory[];
  quiet: boolean;
  threshold?: number | undefined;
}

function readVersion(): string {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(__dirname, "..", "..", "package.json");
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}

function determineInputMode(urls: string[]): "url" | "urls" | "build" {
  if (urls.length > 1) return "urls";
  return "url";
}

async function buildAuditReport(options: BuildAuditOptions): Promise<AuditReport> {
  const startTime = Date.now();

  const rawPages = await runAudit({
    urls: options.urls,
    checks: options.checks,
    quiet: options.quiet,
  });

  const scoredPages = rawPages.map((page) => scorePage(page));
  const overallScore = scoreReport(scoredPages);

  const allFindings = scoredPages.flatMap((page) => page.findings);
  const prioritizedFixes = prioritizeFindings(allFindings);
  const summary = summarizeReport(scoredPages, overallScore);

  const durationMs = Date.now() - startTime;
  const passed = options.threshold === undefined ? true : overallScore >= options.threshold;

  return {
    version: 1,
    summary,
    score: overallScore,
    pages: scoredPages,
    prioritized_fixes: prioritizedFixes,
    meta: {
      foxhole_version: readVersion(),
      node_version: process.version,
      platform: `${process.platform}-${process.arch}`,
      audited_at: new Date(startTime).toISOString(),
      input_mode: determineInputMode(options.urls),
      checks_run: options.checks,
      page_count: options.urls.length,
      duration_ms: durationMs,
      threshold: options.threshold ?? null,
      passed,
      concurrency: 1,
      perf_runs: 1,
      perf_profile: "standard",
      source_maps: "auto",
      // TODO(step-11): read real versions from node_modules package.json
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
  };
}

export { buildAuditReport };
export type { BuildAuditOptions };
