import type { CheckCategory, Effort, Severity } from "../types/index.js";

interface BundleCatalogEntry {
  rule_id: string;
  source: "bundle";
  vendor_rule_id: string | null;
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string;
  description_template: string;
  recommendation: string;
}

const bundleCatalog: Record<string, BundleCatalogEntry> = {
  "bundle/total-js-size": {
    rule_id: "bundle/total-js-size",
    source: "bundle",
    vendor_rule_id: null,
    category: "bundle",
    default_severity: "major",
    default_effort: "high",
    wcag: null,
    title_template: "Total JavaScript transfer size exceeds 500 KB",
    description_template: "Total JavaScript transferred exceeds the 500 KB threshold.",
    recommendation: "Split bundles, remove unused code, and lazy-load non-critical JavaScript.",
  },
  "bundle/large-javascript-chunk": {
    rule_id: "bundle/large-javascript-chunk",
    source: "bundle",
    vendor_rule_id: null,
    category: "bundle",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Single JavaScript resource exceeds 200 KB",
    description_template: "A single JavaScript resource exceeds the 200 KB threshold.",
    recommendation: "Split this bundle into smaller chunks or lazy-load non-critical parts.",
  },
  "bundle/total-css-size": {
    rule_id: "bundle/total-css-size",
    source: "bundle",
    vendor_rule_id: null,
    category: "bundle",
    default_severity: "minor",
    default_effort: "medium",
    wcag: null,
    title_template: "Total CSS transfer size exceeds 100 KB",
    description_template: "Total CSS transferred exceeds the 100 KB threshold.",
    recommendation:
      "Remove unused CSS, split critical from non-critical styles, and load non-critical CSS asynchronously.",
  },
  "bundle/insecure-resource": {
    rule_id: "bundle/insecure-resource",
    source: "bundle",
    vendor_rule_id: null,
    category: "bundle",
    default_severity: "critical",
    default_effort: "low",
    wcag: null,
    title_template: "Resource loaded over insecure HTTP",
    description_template: "A resource is loaded over HTTP instead of HTTPS.",
    recommendation: "Update the resource URL to use HTTPS.",
  },
};

export { bundleCatalog };
export type { BundleCatalogEntry };
