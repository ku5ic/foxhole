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
};

export { lighthouseCatalog };
export type { LighthouseCatalogEntry };
