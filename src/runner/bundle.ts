import type { Page, Response as PlaywrightResponse } from "playwright";

import { RunnerError } from "../errors.js";
import { catalogLookup } from "./catalog-lookup.js";
import { buildTextFingerprint, computeFindingId } from "./finding-id.js";
import type { Finding } from "../types/index.js";

interface BundleRunnerResult {
  findings: Finding[];
  bundle_size: number | null;
}

interface ResourceInfo {
  url: string;
  size: number;
  kind?: "framework" | "application";
}

const JS_CONTENT_TYPES = ["application/javascript", "text/javascript"];
const CSS_CONTENT_TYPES = ["text/css"];
const MAX_TOTAL_JS_BYTES = 500 * 1024;
const MAX_SINGLE_JS_BYTES = 200 * 1024;
const MAX_TOTAL_CSS_BYTES = 100 * 1024;
// Cap on how many bytes we buffer when Content-Length is absent.
// Prevents OOM from unexpectedly large responses with no size header.
const MAX_BODY_BUFFER_BYTES = 10 * 1024 * 1024;
// Body prefix scanned for content signatures. Framework runtime markers appear throughout
// minified bundles; 64 KB covers the preamble where bundler module definitions concentrate.
const CONTENT_SCAN_BYTES = 65_536;

function isContentType(response: PlaywrightResponse, types: string[]): boolean {
  const contentType = response.headers()["content-type"] ?? "";
  return types.some((t) => contentType.includes(t));
}

function hasPathExtension(rawUrl: string, ext: string): boolean {
  try {
    return new URL(rawUrl).pathname.endsWith(ext);
  } catch {
    return rawUrl.endsWith(ext);
  }
}

async function measureResourceSize(response: PlaywrightResponse): Promise<number> {
  const headers = response.headers();
  // Only use Content-Length when the response is not compressed. If content-encoding is present,
  // Content-Length reflects the compressed transfer size while body.length is the decoded size;
  // using the compressed size would let gzipped bundles below the transfer threshold but above
  // the decoded threshold slip past the size checks.
  const encoding = headers["content-encoding"];
  const contentLength = headers["content-length"];
  if (!encoding && contentLength !== undefined) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const body = await response.body();
  return Math.min(body.length, MAX_BODY_BUFFER_BYTES);
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

// Substrings matched against the URL path to identify framework-generated chunks.
// Framework bytes count toward the score (real execution cost), but the recommendation
// differs because the developer cannot split or remove these chunks directly.
const FRAMEWORK_URL_PATTERNS = [
  "/_next/static/chunks/framework", // Next.js React + framework runtime (dev: framework.js, prod: framework-[hash].js)
  "/_next/static/chunks/main-", // Next.js main entry (prod only; dev emits main.js which is a page bundle)
  "/_next/static/chunks/pages/_app", // Next.js app shell
  "/_next/static/chunks/webpack", // Next.js webpack runtime (dev: webpack.js, prod: webpack-[hash].js)
  "/static/js/runtime-main", // Create React App runtime
  "/node_modules/.vite/", // Vite pre-bundled deps
  "/assets/vendor-", // Vite convention: node_modules split chunk
  "/@vite/", // Vite dev HMR client (/@vite/client) and env module (/@vite/env)
  "/@react-refresh", // Vite React plugin Fast Refresh runtime (dev only)
  "/_nuxt/entry.", // Nuxt 3 runtime entry
  "/_nuxt/builds/meta.", // Nuxt 3 build metadata
  "/_app/immutable/entry/", // SvelteKit framework boot
  "/_app/immutable/start-", // SvelteKit Vite runtime shim
  "/@sveltejs/kit/", // SvelteKit dev server internal runtime modules (dev only)
  "/webpack-runtime-", // Gatsby / generic webpack runtime
  "/build/entry.client-", // Remix client entry
] as const;

const FRAMEWORK_CHUNK_RECOMMENDATION =
  "This is a framework chunk. Consider whether the chosen framework fits the project's size budget, or enable more aggressive tree-shaking via the bundler config.";

function classifyResource(url: string): "framework" | "application" {
  const path = sanitizeResourceUrl(url);
  return FRAMEWORK_URL_PATTERNS.some((pattern) => path.includes(pattern))
    ? "framework"
    : "application";
}

// Distinctive static-root path prefixes that identify a known framework app even when no individual
// chunk URL matches FRAMEWORK_URL_PATTERNS (e.g. Turbopack production builds whose chunk names are
// fully hashed with no framework-specific prefix). CRA (/static/), Vite (/assets/), Remix (/build/),
// and Gatsby roots are intentionally omitted: they are too generic to name a framework confidently.
const FRAMEWORK_ROOT_PATTERNS: readonly { pattern: string; name: string }[] = [
  { pattern: "/_next/", name: "Next.js" },
  { pattern: "/_nuxt/", name: "Nuxt" },
  { pattern: "/_app/immutable/", name: "SvelteKit" },
  { pattern: "/_astro/", name: "Astro" },
  // Vite is listed last: it names the bundler, not the UI framework. Framework-specific roots
  // above take precedence so that a SvelteKit or Nuxt app (which both use Vite) is named by
  // its framework, not its bundler.
  { pattern: "/@vite/", name: "Vite" },
];

function detectFramework(urls: string[]): string | null {
  // Patterns are checked in priority order across all URLs, so pattern specificity
  // (controlled by the order of FRAMEWORK_ROOT_PATTERNS) wins over URL load order.
  const paths = urls.map((url) => sanitizeResourceUrl(url));
  for (const { pattern, name } of FRAMEWORK_ROOT_PATTERNS) {
    if (paths.some((path) => path.includes(pattern))) return name;
  }
  return null;
}

// String literals that survive minification and are specific to a framework's runtime source.
// These appear in the framework's own bundle, not in app code that merely imports the framework,
// because minifiers preserve string literals and property keys even when mangling variable names.
// Angular is intentionally omitted: its Ivy function names (ɵɵdefineComponent) also appear in
// compiled app components, making them unreliable for chunk-level classification.
const FRAMEWORK_CONTENT_SIGNATURES = [
  "Minified React error #", // React error URL prefix, emitted many times in react-dom prod builds
  "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED", // React internal sentinel (property key)
  "__vue_app__", // Vue 3 app instance property key, set only inside createApp mount logic
  "__sveltekit_", // SvelteKit runtime global prefix, not present in Svelte component code
] as const;

function classifyByContent(bodyText: string): "framework" | null {
  return FRAMEWORK_CONTENT_SIGNATURES.some((sig) => bodyText.includes(sig)) ? "framework" : null;
}

// Reads the response body once and uses it for both size measurement and content-signature
// classification. For URL-matched framework chunks the body is not read (URL fast-path);
// for unmatched chunks the body is unavoidable because content scanning requires it.
async function measureJsWithClassification(
  response: PlaywrightResponse,
  url: string,
): Promise<ResourceInfo> {
  const urlKind = classifyResource(url);

  if (urlKind === "framework") {
    const size = await measureResourceSize(response);
    return { url, size, kind: "framework" };
  }

  // Read the body once for decoded size and content classification.
  // This bypasses the Content-Length shortcut for unmatched JS chunks, but the body
  // is required for the scan and provides the same decoded-size accuracy.
  const body = await response.body();
  const size = Math.min(body.length, MAX_BODY_BUFFER_BYTES);
  const scan = body.subarray(0, CONTENT_SCAN_BYTES).toString("utf8");
  const kind = classifyByContent(scan) ?? "application";
  return { url, size, kind };
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
    const entry = catalogLookup(ruleId);
    const detail = formatKb(totalJs);
    const frameworkBytes = jsResources
      .filter((r) => (r.kind ?? classifyResource(r.url)) === "framework")
      .reduce((sum, r) => sum + r.size, 0);
    const detectedFramework =
      frameworkBytes === 0 ? detectFramework(jsResources.map((r) => r.url)) : null;
    let totalJsDescription: string;
    if (frameworkBytes > 0) {
      totalJsDescription = `Total JavaScript transferred is ${detail} (${formatKb(frameworkBytes)} framework, ${formatKb(totalJs - frameworkBytes)} application), which exceeds the 500 KB threshold.`;
    } else if (detectedFramework === null) {
      totalJsDescription = `Total JavaScript transferred is ${detail}, which exceeds the 500 KB threshold.`;
    } else {
      totalJsDescription = `Total JavaScript transferred is ${detail}, which exceeds the 500 KB threshold. Detected a ${detectedFramework} app; a framework and application breakdown is not available for this build's chunk naming.`;
    }
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
      description: totalJsDescription,
      recommendation:
        entry?.recommendation ??
        "Split bundles, remove unused code, and lazy-load non-critical JavaScript.",
      selector: null,
      wcag: null,
      impact: null,
      source: null,
      kind: null,
      url: pageUrl,
    });
  }

  for (const resource of jsResources) {
    if (resource.size > MAX_SINGLE_JS_BYTES) {
      const ruleId = "bundle/large-javascript-chunk";
      const entry = catalogLookup(ruleId);
      const sanitized = sanitizeResourceUrl(resource.url);
      const detail = resource.url;
      const kind = resource.kind ?? classifyResource(resource.url);
      const recommendation =
        kind === "framework"
          ? FRAMEWORK_CHUNK_RECOMMENDATION
          : (entry?.recommendation ??
            "Split this bundle into smaller chunks or lazy-load non-critical parts.");
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
        recommendation,
        selector: null,
        wcag: null,
        impact: null,
        source: null,
        kind,
        url: pageUrl,
      });
    }
  }

  if (totalCss > MAX_TOTAL_CSS_BYTES) {
    const ruleId = "bundle/total-css-size";
    const entry = catalogLookup(ruleId);
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
      kind: null,
      url: pageUrl,
    });
  }

  for (const resourceUrl of httpResources) {
    const ruleId = "bundle/insecure-resource";
    const entry = catalogLookup(ruleId);
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
      kind: null,
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

function filterNomoduleResources(
  resources: ResourceInfo[],
  nomoduleUrls: ReadonlySet<string>,
): ResourceInfo[] {
  if (nomoduleUrls.size === 0) return resources;
  return resources.filter((r) => !nomoduleUrls.has(r.url));
}

async function collectNomoduleUrls(page: Page): Promise<Set<string>> {
  try {
    const urls: string[] = await page.evaluate(
      `Array.from(document.querySelectorAll('script[nomodule][src]')).map(el => el.src)`,
    );
    return new Set(urls);
  } catch {
    return new Set();
  }
}

async function runBundleChecks(
  page: Page,
  pageUrl: string,
  quiet: boolean,
): Promise<BundleRunnerResult> {
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

      const isJs =
        isContentType(response, JS_CONTENT_TYPES) || hasPathExtension(responseUrl, ".js");
      const isCss =
        isContentType(response, CSS_CONTENT_TYPES) || hasPathExtension(responseUrl, ".css");

      if (!isJs && !isCss) return;

      if (isJs) {
        const resource = await measureJsWithClassification(response, responseUrl);
        jsResources.push(resource);
        if (isCss) cssResources.push({ url: responseUrl, size: resource.size });
      } else {
        const size = await measureResourceSize(response);
        cssResources.push({ url: responseUrl, size });
      }
    } catch (err) {
      // body may not be available for redirects or certain resource types; non-fatal
      if (!quiet) {
        process.stderr.write(
          `[foxhole] bundle: could not measure ${sanitizeResourceUrl(response.url())}: ${String(err)}\n`,
        );
      }
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  } catch (cause) {
    throw new RunnerError(`Failed to load page for bundle analysis: ${pageUrl}`, cause);
  }

  const nomoduleUrls = await collectNomoduleUrls(page);
  const uniqueJs = filterNomoduleResources(deduplicateResources(jsResources), nomoduleUrls);
  const uniqueCss = deduplicateResources(cssResources);
  const uniqueHttp = [...new Set(httpResources)];

  const findings = buildBundleFindings(uniqueJs, uniqueCss, uniqueHttp, pageUrl);
  const totalJs = uniqueJs.reduce((sum, r) => sum + r.size, 0);

  return {
    findings,
    bundle_size: totalJs > 0 ? totalJs : null,
  };
}

export {
  runBundleChecks,
  buildBundleFindings,
  classifyResource,
  classifyByContent,
  detectFramework,
  filterNomoduleResources,
  sanitizeResourceUrl,
  hasPathExtension,
  measureResourceSize,
};
export type { BundleRunnerResult, ResourceInfo };
