import type { Page, Response as PlaywrightResponse } from "playwright";

import { RunnerError } from "../errors.js";
import type { Finding } from "../types/index.js";

interface BundleRunnerResult {
  findings: Finding[];
  bundle_size: number | null;
}

const JS_CONTENT_TYPES = ["application/javascript", "text/javascript"];
const CSS_CONTENT_TYPES = ["text/css"];
const MAX_TOTAL_JS_BYTES = 500 * 1024;
const MAX_SINGLE_JS_BYTES = 200 * 1024;
const MAX_TOTAL_CSS_BYTES = 100 * 1024;

function isContentType(response: PlaywrightResponse, types: string[]): boolean {
  const contentType = response.headers()["content-type"] ?? "";
  return types.some((t) => contentType.includes(t));
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function runBundleChecks(page: Page, pageUrl: string): Promise<BundleRunnerResult> {
  const jsResources: { url: string; size: number }[] = [];
  const cssResources: { url: string; size: number }[] = [];
  const httpResources: string[] = [];

  const responseHandler = async (response: PlaywrightResponse): Promise<void> => {
    try {
      const responseUrl = response.url();
      const status = response.status();
      if (status < 200 || status >= 300) return;

      if (responseUrl.startsWith("http:") && !responseUrl.includes("localhost")) {
        httpResources.push(responseUrl);
      }

      const body = await response.body();
      const size = body.length;

      if (isContentType(response, JS_CONTENT_TYPES) || responseUrl.endsWith(".js")) {
        jsResources.push({ url: responseUrl, size });
      }

      if (isContentType(response, CSS_CONTENT_TYPES) || responseUrl.endsWith(".css")) {
        cssResources.push({ url: responseUrl, size });
      }
    } catch {
      // response body may not be available for redirects or certain resource types
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  } catch (cause) {
    throw new RunnerError(`Failed to load page for bundle analysis: ${pageUrl}`, cause);
  }

  const findings: Finding[] = [];
  const totalJs = jsResources.reduce((sum, r) => sum + r.size, 0);
  const totalCss = cssResources.reduce((sum, r) => sum + r.size, 0);

  if (totalJs > MAX_TOTAL_JS_BYTES) {
    findings.push({
      id: "bundle-total-js-size",
      category: "bundle",
      severity: "major",
      effort: "high",
      title: "Total JavaScript transfer size exceeds 500 KB",
      description: `Total JavaScript transferred is ${formatKb(totalJs)}, which exceeds the 500 KB threshold.`,
      recommendation: "Split bundles, remove unused code, and lazy-load non-critical JavaScript.",
      selector: null,
      wcag: null,
      impact: null,
      url: pageUrl,
    });
  }

  for (const resource of jsResources) {
    if (resource.size > MAX_SINGLE_JS_BYTES) {
      findings.push({
        id: "bundle-large-javascript-chunk",
        category: "bundle",
        severity: "minor",
        effort: "medium",
        title: "Single JavaScript resource exceeds 200 KB",
        description: `${resource.url} is ${formatKb(resource.size)}.`,
        recommendation: "Split this bundle into smaller chunks or lazy-load non-critical parts.",
        selector: null,
        wcag: null,
        impact: null,
        url: pageUrl,
      });
    }
  }

  if (totalCss > MAX_TOTAL_CSS_BYTES) {
    findings.push({
      id: "bundle-total-css-size",
      category: "bundle",
      severity: "minor",
      effort: "medium",
      title: "Total CSS transfer size exceeds 100 KB",
      description: `Total CSS transferred is ${formatKb(totalCss)}, which exceeds the 100 KB threshold.`,
      recommendation:
        "Remove unused CSS, split critical from non-critical styles, and load non-critical CSS asynchronously.",
      selector: null,
      wcag: null,
      impact: null,
      url: pageUrl,
    });
  }

  for (const resourceUrl of httpResources) {
    findings.push({
      id: "bundle-insecure-resource",
      category: "bundle",
      severity: "critical",
      effort: "low",
      title: "Resource loaded over insecure HTTP",
      description: `${resourceUrl} is loaded over HTTP instead of HTTPS.`,
      recommendation: "Update the resource URL to use HTTPS.",
      selector: null,
      wcag: null,
      impact: null,
      url: pageUrl,
    });
  }

  return {
    findings,
    bundle_size: totalJs > 0 ? totalJs : null,
  };
}

export { runBundleChecks };
export type { BundleRunnerResult };
