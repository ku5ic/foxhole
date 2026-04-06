import { RunnerError } from "../errors.js";
import { createBrowser, createPage, waitForPageReady } from "./browser.js";
import { runAxe } from "./axe.js";
import { runLighthouse } from "./lighthouse.js";
import { runSemanticChecks } from "./semantic.js";
import { runBundleChecks } from "./bundle.js";
import type { CheckCategory, Finding, PageResult, PerformanceMetrics } from "../types/index.js";

interface RunnerOptions {
  urls: string[];
  checks: CheckCategory[];
  quiet: boolean;
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

async function runAudit(options: RunnerOptions): Promise<PageResult[]> {
  const results: PageResult[] = [];

  for (const url of options.urls) {
    log(`Auditing ${url}`, options.quiet);

    const browser = await createBrowser();
    try {
      const page = await createPage(browser);
      let metrics = emptyMetrics();
      const findings: Finding[] = [];

      // Navigate for non-bundle checks (bundle runner does its own navigation)
      const needsNavigation = options.checks.some((c) => c !== "bundle");
      if (needsNavigation) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await waitForPageReady(page);
        } catch (cause) {
          throw new RunnerError(`Failed to navigate to ${url}`, cause);
        }
      }

      if (options.checks.includes("a11y")) {
        log("Running accessibility checks", options.quiet);
        const axeResult = await runAxe(page, url);
        findings.push(...axeResult.findings);
      }

      if (options.checks.includes("perf")) {
        log("Running performance checks", options.quiet);
        const lighthouseResult = await runLighthouse(url);
        metrics = { ...metrics, ...lighthouseResult.metrics };
        findings.push(...lighthouseResult.findings);
      }

      if (options.checks.includes("semantic")) {
        log("Running semantic checks", options.quiet);
        const semanticResult = await runSemanticChecks(page, url);
        findings.push(...semanticResult.findings);
      }

      if (options.checks.includes("bundle")) {
        log("Running bundle checks", options.quiet);
        const bundlePage = await createPage(browser);
        const bundleResult = await runBundleChecks(bundlePage, url);
        findings.push(...bundleResult.findings);
        metrics = { ...metrics, bundle_size: bundleResult.bundle_size };
        await bundlePage.close();
      }

      results.push({
        url,
        score: 0,
        categories: [],
        findings,
        metrics,
        audited_at: new Date().toISOString(),
      });
    } finally {
      await browser.close();
    }
  }

  return results;
}

export { runAudit };
export type { RunnerOptions };
