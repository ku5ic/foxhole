import { RunnerError, formatErrorChain } from "../errors.js";
import { createBrowser, createPage, waitForPageReady } from "./browser.js";
import { runAxe } from "./axe.js";
import { runLighthouse } from "./lighthouse.js";
import type { LighthouseRunnerResult } from "./lighthouse.js";
import { runSemanticChecks } from "./semantic.js";
import { runBundleChecks } from "./bundle.js";
import type {
  CategorySummary,
  CheckCategory,
  Finding,
  PageResult,
  PerformanceMetrics,
  ThrottlingPreset,
} from "../types/index.js";

interface RunnerOptions {
  urls: string[];
  checks: CheckCategory[];
  quiet: boolean;
  throttling: ThrottlingPreset;
  concurrency: number;
}

interface CheckDescriptor {
  category: CheckCategory;
  run: () => Promise<{ findings: Finding[]; metricsPatch?: Partial<PerformanceMetrics> }>;
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
    framework_bundle_size: null,
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

// Lighthouse uses process-global performance.mark()/clearMarks() internally.
// Two concurrent Lighthouse runs in the same Node.js process stomp each other's
// named marks, producing "mark not found" errors. This queue serializes them.
let lighthouseQueueTail: Promise<unknown> = Promise.resolve();

function runLighthouseQueued(
  url: string,
  cdpPort: number,
  throttling: ThrottlingPreset,
): Promise<LighthouseRunnerResult> {
  const entry = lighthouseQueueTail.then(() => runLighthouse(url, cdpPort, throttling));
  lighthouseQueueTail = entry.catch(() => null);
  return entry;
}

async function auditSinglePage(url: string, options: RunnerOptions): Promise<PageResult> {
  const pageStartTime = Date.now();
  log(`Auditing ${url}`, options.quiet);

  try {
    const { browser, server, cdpPort } = await createBrowser();
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

      const descriptors: CheckDescriptor[] = [];

      if (options.checks.includes("a11y")) {
        descriptors.push({
          category: "a11y",
          run: async () => {
            const result = await runAxe(page, url);
            return { findings: result.findings };
          },
        });
      }

      if (options.checks.includes("perf")) {
        descriptors.push({
          category: "perf",
          run: async () => {
            const result = await runLighthouseQueued(url, cdpPort, options.throttling);
            return { findings: result.findings, metricsPatch: result.metrics };
          },
        });
      }

      if (options.checks.includes("semantic")) {
        descriptors.push({
          category: "semantic",
          run: async () => {
            const result = await runSemanticChecks(page, url);
            return { findings: result.findings };
          },
        });
      }

      if (options.checks.includes("bundle")) {
        descriptors.push({
          category: "bundle",
          run: async () => {
            const bundlePage = await createPage(browser);
            try {
              const result = await runBundleChecks(bundlePage, url, options.quiet);
              return {
                findings: result.findings,
                metricsPatch: {
                  bundle_size: result.bundle_size,
                  framework_bundle_size: result.framework_bundle_size,
                },
              };
            } finally {
              await bundlePage.close();
            }
          },
        });
      }

      for (const descriptor of descriptors) {
        log(`Running ${descriptor.category} checks`, options.quiet);
        try {
          const result = await descriptor.run();
          findings.push(...result.findings);
          if (result.metricsPatch !== undefined) {
            metrics = { ...metrics, ...result.metricsPatch };
          }
        } catch (error) {
          const msg = formatErrorChain(error);
          log(`${descriptor.category} runner failed: ${msg}`, options.quiet);
          erroredCategories.push(buildErroredCategorySummary(descriptor.category, msg));
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

export { type ThrottlingPreset } from "../types/index.js";
