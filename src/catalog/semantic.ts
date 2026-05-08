import type { CheckCategory, Effort, Severity } from "../types/index.js";

interface SemanticCatalogEntry {
  rule_id: string;
  source: "semantic";
  vendor_rule_id: string | null;
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string;
  description_template: string;
  recommendation: string;
}

const semanticCatalog: Record<string, SemanticCatalogEntry> = {
  "semantic/missing-h1": {
    rule_id: "semantic/missing-h1",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "major",
    default_effort: "low",
    wcag: null,
    title_template: "Missing h1 element",
    description_template: "Page has no h1 element.",
    recommendation: "Add a single h1 element that describes the page content.",
  },
  "semantic/multiple-h1": {
    rule_id: "semantic/multiple-h1",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Multiple h1 elements",
    description_template: "Page has more than one h1 element.",
    recommendation: "Use a single h1 per page. Demote extra h1 elements to h2 or lower.",
  },
  "semantic/skipped-heading-level": {
    rule_id: "semantic/skipped-heading-level",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Skipped heading level",
    description_template: "Heading level skipped in the document outline.",
    recommendation: "Use heading levels in sequential order without skipping levels.",
  },
  "semantic/interactive-no-text": {
    rule_id: "semantic/interactive-no-text",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "major",
    default_effort: "low",
    wcag: null,
    title_template: "Interactive element without accessible text",
    description_template: "A button or link element has no accessible text.",
    recommendation: "Add visible text, an aria-label, or a title attribute to the element.",
  },
  "semantic/input-no-label": {
    rule_id: "semantic/input-no-label",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "major",
    default_effort: "low",
    wcag: null,
    title_template: "Form input without associated label",
    description_template: "A form input has no associated label element.",
    recommendation: "Associate a label element with each form input using the for attribute.",
  },
  "semantic/img-no-alt": {
    rule_id: "semantic/img-no-alt",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "major",
    default_effort: "low",
    wcag: null,
    title_template: "Image missing alt attribute",
    description_template: "An img element has no alt attribute.",
    recommendation: 'Add a descriptive alt attribute to the image, or alt="" if decorative.',
  },
  "semantic/fake-button-no-keyboard": {
    rule_id: "semantic/fake-button-no-keyboard",
    source: "semantic",
    vendor_rule_id: null,
    category: "semantic",
    default_severity: "minor",
    default_effort: "low",
    wcag: null,
    title_template: "Custom button missing keyboard access",
    description_template: "An element with role=button has no tabindex for keyboard access.",
    recommendation: 'Add tabindex="0" and keyboard event handlers to custom button elements.',
  },
};

export { semanticCatalog };
export type { SemanticCatalogEntry };
