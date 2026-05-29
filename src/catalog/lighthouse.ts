import type { CheckCategory, Effort, Severity } from "../types/index.js";

interface LighthouseCatalogEntry {
  rule_id: string;
  source: "lighthouse";
  vendor_rule_id: string | null;
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string;
  description_template: string;
  recommendation: string;
}

const lighthouseCatalog: Record<string, LighthouseCatalogEntry> = {
  "perf/render-blocking-resources": {
    rule_id: "perf/render-blocking-resources",
    source: "lighthouse",
    vendor_rule_id: "render-blocking-resources",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Eliminate render-blocking resources",
    description_template: "Resources are blocking the first paint of the page.",
    recommendation:
      "Defer or inline critical CSS and JavaScript. Use rel=preload for critical resources and async or defer for non-critical scripts.",
  },
  "perf/unused-css-rules": {
    rule_id: "perf/unused-css-rules",
    source: "lighthouse",
    vendor_rule_id: "unused-css-rules",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Reduce unused CSS",
    description_template: "CSS rules are loaded but not used by the page.",
    recommendation:
      "Remove unused CSS, use PurgeCSS or a similar tool, or split stylesheets to load only what is needed per page.",
  },
  "perf/unused-javascript": {
    rule_id: "perf/unused-javascript",
    source: "lighthouse",
    vendor_rule_id: "unused-javascript",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Reduce unused JavaScript",
    description_template: "JavaScript is loaded but not executed during page load.",
    recommendation:
      "Remove unused code, use tree shaking, or lazy-load modules that are not needed on initial load.",
  },
  "perf/largest-contentful-paint-element": {
    rule_id: "perf/largest-contentful-paint-element",
    source: "lighthouse",
    vendor_rule_id: "largest-contentful-paint-element",
    category: "perf",
    default_severity: "critical",
    default_effort: "medium",
    wcag: null,
    title_template: "Largest Contentful Paint element was slow",
    description_template: "The element that defines LCP loaded too slowly.",
    recommendation:
      "Preload the LCP image, reduce its size, use a CDN, and eliminate any render-blocking resources that delay its discovery.",
  },
  "perf/uses-text-compression": {
    rule_id: "perf/uses-text-compression",
    source: "lighthouse",
    vendor_rule_id: "uses-text-compression",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Enable text compression",
    description_template: "Text-based resources are served without compression.",
    recommendation: "Configure your server to compress text responses using gzip or Brotli.",
  },
  "perf/uses-responsive-images": {
    rule_id: "perf/uses-responsive-images",
    source: "lighthouse",
    vendor_rule_id: "uses-responsive-images",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Serve images in appropriate sizes",
    description_template: "Images are significantly larger than the display size.",
    recommendation:
      "Use srcset and sizes attributes to serve appropriately sized images, or use an image CDN that resizes on the fly.",
  },
  "perf/unminified-css": {
    rule_id: "perf/unminified-css",
    source: "lighthouse",
    vendor_rule_id: "unminified-css",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Minify CSS",
    description_template: "CSS files are not minified.",
    recommendation: "Minify CSS files using a build tool such as cssnano, Lightning CSS, or Vite.",
  },
  "perf/unminified-javascript": {
    rule_id: "perf/unminified-javascript",
    source: "lighthouse",
    vendor_rule_id: "unminified-javascript",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Minify JavaScript",
    description_template: "JavaScript files are not minified.",
    recommendation: "Minify JavaScript using Terser, esbuild, or your bundler's production mode.",
  },
  "perf/efficient-animated-content": {
    rule_id: "perf/efficient-animated-content",
    source: "lighthouse",
    vendor_rule_id: "efficient-animated-content",
    category: "perf",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Use video formats for animated content",
    description_template: "Animated GIFs are larger and slower than equivalent video formats.",
    recommendation: "Convert animated GIFs to MP4 or WebM and use a <video> element instead.",
  },
  "perf/uses-optimized-images": {
    rule_id: "perf/uses-optimized-images",
    source: "lighthouse",
    vendor_rule_id: "uses-optimized-images",
    category: "perf",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Efficiently encode images",
    description_template: "Images could be compressed further without visible quality loss.",
    recommendation:
      "Compress images with tools like Squoosh, imagemin, or Sharp. Aim for the smallest file size that maintains acceptable quality.",
  },
  "perf/modern-image-formats": {
    rule_id: "perf/modern-image-formats",
    source: "lighthouse",
    vendor_rule_id: "modern-image-formats",
    category: "perf",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Serve images in modern formats",
    description_template: "Images are served in older formats instead of WebP or AVIF.",
    recommendation:
      "Convert images to WebP or AVIF and use the <picture> element with a JPEG or PNG fallback for older browsers.",
  },
  "perf/total-byte-weight": {
    rule_id: "perf/total-byte-weight",
    source: "lighthouse",
    vendor_rule_id: "total-byte-weight",
    category: "perf",
    default_severity: "major",
    default_effort: "high",
    wcag: null,
    title_template: "Avoid enormous network payloads",
    description_template: "The total size of all network resources is too large.",
    recommendation:
      "Reduce total page weight by compressing assets, deferring non-critical resources, and removing unused dependencies.",
  },
  "perf/server-response-time": {
    rule_id: "perf/server-response-time",
    source: "lighthouse",
    vendor_rule_id: "server-response-time",
    category: "perf",
    default_severity: "major",
    default_effort: "high",
    wcag: null,
    title_template: "Reduce initial server response time (TTFB)",
    description_template: "The server took too long to respond to the initial document request.",
    recommendation:
      "Profile server-side rendering time, enable caching for repeated requests, and consider moving computation to a CDN edge function or static generation where possible.",
  },
  "perf/dom-size": {
    rule_id: "perf/dom-size",
    source: "lighthouse",
    vendor_rule_id: "dom-size",
    category: "perf",
    default_severity: "minor",
    default_effort: "high",
    wcag: null,
    title_template: "Avoid excessive DOM size",
    description_template: "A large DOM increases memory usage and slows style calculations.",
    recommendation:
      "Reduce the number of DOM nodes by virtualizing long lists, lazy-rendering off-screen content, and removing elements that are only conditionally needed.",
  },
  "perf/uses-long-cache-ttl": {
    rule_id: "perf/uses-long-cache-ttl",
    source: "lighthouse",
    vendor_rule_id: "uses-long-cache-ttl",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Serve static assets with an efficient cache policy",
    description_template: "Static resources are served without long-lived cache headers.",
    recommendation:
      "Set Cache-Control: max-age=31536000, immutable on versioned static assets and use content-hashed filenames so caches can be invalidated by deploying new URLs.",
  },
  "perf/offscreen-images": {
    rule_id: "perf/offscreen-images",
    source: "lighthouse",
    vendor_rule_id: "offscreen-images",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Defer offscreen images",
    description_template: "Images outside the initial viewport are loaded eagerly.",
    recommendation:
      'Add loading="lazy" to images below the fold, or use an Intersection Observer to load them only when they approach the viewport.',
  },
  "perf/uses-rel-preconnect": {
    rule_id: "perf/uses-rel-preconnect",
    source: "lighthouse",
    vendor_rule_id: "uses-rel-preconnect",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Preconnect to required origins",
    description_template: "Critical third-party origins are not preconnected before use.",
    recommendation:
      'Add <link rel="preconnect" href="https://origin"> in the document head for each critical third-party origin, such as font providers and analytics endpoints.',
  },
  "perf/bootup-time": {
    rule_id: "perf/bootup-time",
    source: "lighthouse",
    vendor_rule_id: "bootup-time",
    category: "perf",
    default_severity: "major",
    default_effort: "high",
    wcag: null,
    title_template: "Reduce JavaScript execution time",
    description_template: "JavaScript takes too long to parse, compile, and execute on load.",
    recommendation:
      "Split large bundles, remove unused code, and defer or lazy-load scripts that are not needed for the initial render. Profile with the Performance panel to identify the heaviest call trees.",
  },
  "perf/third-party-summary": {
    rule_id: "perf/third-party-summary",
    source: "lighthouse",
    vendor_rule_id: "third-party-summary",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Reduce the impact of third-party code",
    description_template: "Third-party scripts contribute significant blocking time or payload.",
    recommendation:
      "Audit which third-party scripts are essential, load non-critical ones with async or defer, and consider self-hosting frequently used scripts to eliminate extra DNS lookups.",
  },
  "perf/font-display": {
    rule_id: "perf/font-display",
    source: "lighthouse",
    vendor_rule_id: "font-display",
    category: "perf",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Ensure text remains visible during web font load",
    description_template: "Web fonts are loaded without a font-display strategy.",
    recommendation:
      "Add font-display: swap (or optional for non-critical fonts) to all @font-face declarations so the browser renders fallback text immediately instead of hiding it while fonts download.",
  },
  "perf/largest-contentful-paint": {
    rule_id: "perf/largest-contentful-paint",
    source: "lighthouse",
    vendor_rule_id: "largest-contentful-paint",
    category: "perf",
    default_severity: "major",
    default_effort: "high",
    wcag: null,
    title_template: "Largest Contentful Paint is slow",
    description_template: "LCP measures how long the largest visible element takes to render.",
    recommendation:
      "Preload the LCP resource, eliminate render-blocking resources that delay its discovery, serve it from a CDN, and compress it. Target LCP under 2.5s.",
  },
  "perf/max-potential-fid": {
    rule_id: "perf/max-potential-fid",
    source: "lighthouse",
    vendor_rule_id: "max-potential-fid",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Max Potential First Input Delay is high",
    description_template:
      "The longest task on the main thread determines the worst-case input delay.",
    recommendation:
      "Break up long tasks into smaller chunks using scheduler.yield() or setTimeout, and move heavy computation off the main thread with a Web Worker.",
  },
  "perf/interactive": {
    rule_id: "perf/interactive",
    source: "lighthouse",
    vendor_rule_id: "interactive",
    category: "perf",
    default_severity: "critical",
    default_effort: "high",
    wcag: null,
    title_template: "Time to Interactive is high",
    description_template:
      "Time to Interactive measures how long until the page is fully interactive and responsive.",
    recommendation:
      "Reduce JavaScript execution time on load: split bundles, defer non-critical scripts, and minimize long tasks that block the main thread after initial render.",
  },
  "perf/bf-cache": {
    rule_id: "perf/bf-cache",
    source: "lighthouse",
    vendor_rule_id: "bf-cache",
    category: "perf",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Page prevented back/forward cache restoration",
    description_template:
      "The page is ineligible for bfcache, so navigating back requires a full reload.",
    recommendation:
      "Remove unload event listeners, avoid Cache-Control: no-store on the document, close open WebSocket or IndexedDB connections before unload, and check the Lighthouse bfcache section for the specific blocking reason.",
  },
  "perf/network-dependency-tree-insight": {
    rule_id: "perf/network-dependency-tree-insight",
    source: "lighthouse",
    vendor_rule_id: "network-dependency-tree-insight",
    category: "perf",
    default_severity: "major",
    default_effort: "medium",
    wcag: null,
    title_template: "Reduce the depth of critical request chains",
    description_template:
      "Long chains of dependent requests delay page rendering because each link must resolve before the next begins.",
    recommendation:
      "Preload critical resources with <link rel=preload>, flatten dependency chains where possible, and inline the smallest critical resources to eliminate a network round-trip.",
  },
};

export { lighthouseCatalog };
export type { LighthouseCatalogEntry };
