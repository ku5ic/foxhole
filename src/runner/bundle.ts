import type { Page, Response as PlaywrightResponse } from "playwright";

import { catalog } from "../catalog/index.js";
import { RunnerError } from "../errors.js";
import { buildTextFingerprint, computeFindingId } from "./finding-id.js";
import type { Finding } from "../types/index.js";

interface BundleRunnerResult {
  findings: Finding[];
  bundle_size: number | null;
}

interface ResourceInfo {
  url: string;
  size: number;
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

function sanitizeResourceUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const p = parsed.pathname;
    return p.length > 200 ? p.slice(0, 200) : p;
  } catch {
    const qi = rawUrl.indexOf("?");
    const path = qi === -1 ? rawUrl : rawUrl.slice(0, qi);
    return path.length > 200 ? path.slice(0, 200) : path;
  }
}

function buildBundleFindings(
  jsResources: ResourceInfo[],
  cssResources: ResourceInfo[],
  httpResources: string[],
  pageUrl: string,
): Finding[] {
  const findings: Finding[] = [];
  const totalJs = jsResources.reduce((sum, r) => sum + r.size, 0);
  const totalCss = cssResources.reduce((sum, r) => sum + r.size, 0);

  if (totalJs > MAX_TOTAL_JS_BYTES) {
    const ruleId = "bundle/total-js-size";
    const entry = catalog[ruleId];
    const detail = formatKb(totalJs);
    findings.push({
      id: computeFindingId({
        pageUrl,
        ruleId,
        semanticPath: "",
        // Empty detail: ruleId + pageUrl already uniquely identify this single-instance finding.
        // Passing the measured KB would make the ID change across runs.
        textFingerprint: buildTextFingerprint({ ruleId, detail: "" }),
      }),
      category: "bundle",
      severity: entry?.default_severity ?? "major",
      effort: entry?.default_effort ?? "high",
      rule_id: ruleId,
      title: entry?.title_template ?? "Total JavaScript transfer size exceeds 500 KB",
      description: `Total JavaScript transferred is ${detail}, which exceeds the 500 KB threshold.`,
      recommendation:
        entry?.recommendation ??
        "Split bundles, remove unused code, and lazy-load non-critical JavaScript.",
      selector: null,
      wcag: null,
      impact: null,
      source: null,
      url: pageUrl,
    });
  }

  for (const resource of jsResources) {
    if (resource.size > MAX_SINGLE_JS_BYTES) {
      const ruleId = "bundle/large-javascript-chunk";
      const entry = catalog[ruleId];
      const sanitized = sanitizeResourceUrl(resource.url);
      const detail = resource.url;
      findings.push({
        id: computeFindingId({
          pageUrl,
          ruleId,
          semanticPath: sanitized,
          textFingerprint: buildTextFingerprint({ ruleId, detail }),
        }),
        category: "bundle",
        severity: entry?.default_severity ?? "minor",
        effort: entry?.default_effort ?? "medium",
        rule_id: ruleId,
        title: entry?.title_template ?? "Single JavaScript resource exceeds 200 KB",
        description: `${sanitized} is ${formatKb(resource.size)}.`,
        recommendation:
          entry?.recommendation ??
          "Split this bundle into smaller chunks or lazy-load non-critical parts.",
        selector: null,
        wcag: null,
        impact: null,
        source: null,
        url: pageUrl,
      });
    }
  }

  if (totalCss > MAX_TOTAL_CSS_BYTES) {
    const ruleId = "bundle/total-css-size";
    const entry = catalog[ruleId];
    const detail = formatKb(totalCss);
    findings.push({
      id: computeFindingId({
        pageUrl,
        ruleId,
        semanticPath: "",
        // Empty detail: ruleId + pageUrl already uniquely identify this single-instance finding.
        textFingerprint: buildTextFingerprint({ ruleId, detail: "" }),
      }),
      category: "bundle",
      severity: entry?.default_severity ?? "minor",
      effort: entry?.default_effort ?? "medium",
      rule_id: ruleId,
      title: entry?.title_template ?? "Total CSS transfer size exceeds 100 KB",
      description: `Total CSS transferred is ${detail}, which exceeds the 100 KB threshold.`,
      recommendation:
        entry?.recommendation ??
        "Remove unused CSS, split critical from non-critical styles, and load non-critical CSS asynchronously.",
      selector: null,
      wcag: null,
      impact: null,
      source: null,
      url: pageUrl,
    });
  }

  for (const resourceUrl of httpResources) {
    const ruleId = "bundle/insecure-resource";
    const entry = catalog[ruleId];
    const sanitized = sanitizeResourceUrl(resourceUrl);
    findings.push({
      id: computeFindingId({
        pageUrl,
        ruleId,
        semanticPath: sanitized,
        textFingerprint: buildTextFingerprint({ ruleId, detail: resourceUrl }),
      }),
      category: "bundle",
      severity: entry?.default_severity ?? "critical",
      effort: entry?.default_effort ?? "low",
      rule_id: ruleId,
      title: entry?.title_template ?? "Resource loaded over insecure HTTP",
      description: `${sanitized} is loaded over HTTP instead of HTTPS.`,
      recommendation: entry?.recommendation ?? "Update the resource URL to use HTTPS.",
      selector: null,
      wcag: null,
      impact: null,
      source: null,
      url: pageUrl,
    });
  }

  return findings;
}

function deduplicateResources(resources: ResourceInfo[]): ResourceInfo[] {
  const seen = new Map<string, ResourceInfo>();
  for (const resource of resources) {
    const key = sanitizeResourceUrl(resource.url);
    const existing = seen.get(key);
    if (!existing || resource.size > existing.size) {
      seen.set(key, resource);
    }
  }
  return [...seen.values()];
}

async function runBundleChecks(page: Page, pageUrl: string): Promise<BundleRunnerResult> {
  const jsResources: ResourceInfo[] = [];
  const cssResources: ResourceInfo[] = [];
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

  const uniqueJs = deduplicateResources(jsResources);
  const uniqueCss = deduplicateResources(cssResources);
  const uniqueHttp = [...new Set(httpResources)];

  const findings = buildBundleFindings(uniqueJs, uniqueCss, uniqueHttp, pageUrl);
  const totalJs = uniqueJs.reduce((sum, r) => sum + r.size, 0);

  return {
    findings,
    bundle_size: totalJs > 0 ? totalJs : null,
  };
}

export { runBundleChecks, buildBundleFindings, sanitizeResourceUrl };
export type { BundleRunnerResult, ResourceInfo };
