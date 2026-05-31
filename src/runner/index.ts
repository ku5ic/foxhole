import { RunnerError, formatErrorChain } from "../errors.js";
import { createBrowser, createPage, waitForPageReady, extractCdpPort } from "./browser.js";
import { runAxe } from "./axe.js";
import { runLighthouse } from "./lighthouse.js";
import type { ThrottlingPreset } from "./lighthouse.js";
import { runSemanticChecks } from "./semantic.js";
import { runBundleChecks } from "./bundle.js";
import type {
  CategorySummary,
  CheckCategory,
  Finding,
  PageResult,
  PerformanceMetrics,
} from "../types/index.js";

interface RunnerOptions {
  urls: string[];
  checks: CheckCategory[];
  quiet: boolean;
  throttling: ThrottlingPreset;
  concurrency: number;
}

function log(message: string, quiet: boolean): void {
  if (!quiet) {
    process.stderr.write(`[foxhole] ${message}\n`);
  }
}

function emptyMetrics(): PerformanceMetrics {
  return {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    tbt: null,
    performance_score: null,
    accessibility_score: null,
    bundle_size: null,
  };
}

function buildErroredCategorySummary(category: CheckCategory, message: string): CategorySummary {
  return {
    category,
    status: "errored",
    error: { message },
    score: 0,
    findings_count: 0,
    critical_count: 0,
    major_count: 0,
    minor_count: 0,
  };
}

function buildErroredPageResult(
  url: string,
  checks: CheckCategory[],
  message: string,
  duration_ms: number,
): PageResult {
  return {
    url,
    status: "errored",
    error: { message },
    score: 0,
    categories: checks.map((c) => buildErroredCategorySummary(c, message)),
    findings: [],
    metrics: emptyMetrics(),
    audited_at: new Date().toISOString(),
    duration_ms,
  };
}

async function auditSinglePage(url: string, options: RunnerOptions): Promise<PageResult> {
  const pageStartTime = Date.now();
  log(`Auditing ${url}`, options.quiet);

  try {
    const { browser, server } = await createBrowser();
    try {
      const page = await createPage(browser);
      let metrics = emptyMetrics();
      const findings: Finding[] = [];
      const erroredCategories: CategorySummary[] = [];

      const needsNavigation = options.checks.some((c) => c !== "bundle");
      if (needsNavigation) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await waitForPageReady(page);
        } catch (cause) {
          throw new RunnerError("Failed to navigate to page", cause);
        }
      }

      if (options.checks.includes("a11y")) {
        log("Running accessibility checks", options.quiet);
        try {
          const axeResult = await runAxe(page, url);
          findings.push(...axeResult.findings);
        } catch (error) {
          const msg = formatErrorChain(error);
          log(`a11y runner failed: ${msg}`, options.quiet);
          erroredCategories.push(buildErroredCategorySummary("a11y", msg));
        }
      }

      if (options.checks.includes("perf")) {
        log("Running performance checks", options.quiet);
        try {
          const port = extractCdpPort(server.wsEndpoint());
          const lighthouseResult = await runLighthouse(url, port, options.throttling);
          metrics = { ...metrics, ...lighthouseResult.metrics };
          findings.push(...lighthouseResult.findings);
        } catch (error) {
          const msg = formatErrorChain(error);
          log(`perf runner failed: ${msg}`, options.quiet);
          erroredCategories.push(buildErroredCategorySummary("perf", msg));
        }
      }

      if (options.checks.includes("semantic")) {
        log("Running semantic checks", options.quiet);
        try {
          const semanticResult = await runSemanticChecks(page, url);
          findings.push(...semanticResult.findings);
        } catch (error) {
          const msg = formatErrorChain(error);
          log(`semantic runner failed: ${msg}`, options.quiet);
          erroredCategories.push(buildErroredCategorySummary("semantic", msg));
        }
      }

      if (options.checks.includes("bundle")) {
        log("Running bundle checks", options.quiet);
        let bundlePage;
        try {
          bundlePage = await createPage(browser);
          const bundleResult = await runBundleChecks(bundlePage, url, options.quiet);
          findings.push(...bundleResult.findings);
          metrics = { ...metrics, bundle_size: bundleResult.bundle_size };
        } catch (error) {
          const msg = formatErrorChain(error);
          log(`bundle runner failed: ${msg}`, options.quiet);
          erroredCategories.push(buildErroredCategorySummary("bundle", msg));
        } finally {
          await bundlePage?.close();
        }
      }

      return {
        url,
        status: "ok",
        error: null,
        score: 0,
        categories: erroredCategories,
        findings,
        metrics,
        audited_at: new Date().toISOString(),
        duration_ms: Date.now() - pageStartTime,
      };
    } finally {
      await browser.close();
      await server.close();
    }
  } catch (error) {
    if (!(error instanceof RunnerError)) throw error;
    const msg = formatErrorChain(error);
    // Navigation failures always emit regardless of quiet.
    process.stderr.write(`[foxhole] failed ${url}: ${msg}\n`);
    return buildErroredPageResult(url, options.checks, msg, Date.now() - pageStartTime);
  }
}

// Runs fn on each URL with at most concurrency calls in flight simultaneously.
// Result order matches input order.
async function runWithConcurrency(
  urls: string[],
  concurrency: number,
  fn: (url: string) => Promise<PageResult>,
): Promise<PageResult[]> {
  if (urls.length === 0) return [];
  const results = Array.from<PageResult>({ length: urls.length });
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < urls.length) {
      const index = nextIndex++;
      const url = urls[index];
      if (url !== undefined) {
        results[index] = await fn(url);
      }
    }
  };

  const workerCount = Math.min(Math.max(1, concurrency), urls.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function runAudit(options: RunnerOptions): Promise<PageResult[]> {
  if (options.concurrency > 1 && options.checks.includes("perf")) {
    process.stderr.write(
      "[foxhole] warning: --concurrency > 1 with perf checks produces noisier Lighthouse scores\n",
    );
  }

  return runWithConcurrency(options.urls, options.concurrency, (url) =>
    auditSinglePage(url, options),
  );
}

export { runAudit, runWithConcurrency };
export type { RunnerOptions };

export { type ThrottlingPreset } from "./lighthouse.js";
