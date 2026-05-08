import type { Page } from "playwright";

import { RunnerError } from "../errors.js";
import type { Finding } from "../types/index.js";

interface SemanticRunnerResult {
  findings: Finding[];
}

interface SemanticCheckResult {
  check: string;
  issues: { selector: string | null; detail: string }[];
}

const SEMANTIC_CHECKS_SCRIPT = `(() => {
  const checks = [];

  const h1s = document.querySelectorAll("h1");
  if (h1s.length === 0) {
    checks.push({ check: "missing-h1", issues: [{ selector: null, detail: "Page has no h1 element" }] });
  } else if (h1s.length > 1) {
    checks.push({
      check: "multiple-h1",
      issues: Array.from(h1s).slice(1).map(el => ({
        selector: el.tagName.toLowerCase(),
        detail: "Page has " + h1s.length + " h1 elements"
      }))
    });
  }

  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  let prevLevel = 0;
  for (const heading of headings) {
    const level = parseInt(heading.tagName.charAt(1), 10);
    if (prevLevel > 0 && level > prevLevel + 1) {
      checks.push({
        check: "skipped-heading-level",
        issues: [{ selector: heading.tagName.toLowerCase(), detail: "Heading level skipped from h" + prevLevel + " to h" + level }]
      });
    }
    prevLevel = level;
  }

  const interactives = document.querySelectorAll("button, a");
  const noText = [];
  for (const el of interactives) {
    const text = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (text === "") {
      noText.push({ selector: el.tagName.toLowerCase(), detail: el.tagName.toLowerCase() + " has no accessible text" });
    }
  }
  if (noText.length > 0) checks.push({ check: "interactive-no-text", issues: noText });

  const inputs = document.querySelectorAll("input, select, textarea");
  const unlabeled = [];
  for (const input of inputs) {
    if (input.type === "hidden") continue;
    const id = input.getAttribute("id");
    const hasLabel = id ? document.querySelector('label[for="' + id + '"]') !== null : false;
    const hasAriaLabel = input.getAttribute("aria-label") !== null;
    const hasAriaLabelledBy = input.getAttribute("aria-labelledby") !== null;
    const wrappedInLabel = input.closest("label") !== null;
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !wrappedInLabel) {
      unlabeled.push({ selector: input.tagName.toLowerCase(), detail: "Form input has no associated label" });
    }
  }
  if (unlabeled.length > 0) checks.push({ check: "input-no-label", issues: unlabeled });

  const images = document.querySelectorAll("img");
  const noAlt = [];
  for (const img of images) {
    if (!img.hasAttribute("alt")) {
      noAlt.push({ selector: "img", detail: "Image has no alt attribute" });
    }
  }
  if (noAlt.length > 0) checks.push({ check: "img-no-alt", issues: noAlt });

  const fakeButtons = document.querySelectorAll('div[role="button"], span[role="button"]');
  const noKeyboard = [];
  for (const el of fakeButtons) {
    if (!el.hasAttribute("tabindex")) {
      noKeyboard.push({ selector: el.tagName.toLowerCase() + '[role="button"]', detail: "Element with role=button has no tabindex for keyboard access" });
    }
  }
  if (noKeyboard.length > 0) checks.push({ check: "fake-button-no-keyboard", issues: noKeyboard });

  return checks;
})()`;

async function runSemanticChecks(page: Page, pageUrl: string): Promise<SemanticRunnerResult> {
  try {
    const rawResults: unknown = await page.evaluate(SEMANTIC_CHECKS_SCRIPT);
    const results = rawResults as SemanticCheckResult[];

    const findings = results.flatMap((result) => mapSemanticResultToFindings(result, pageUrl));

    return { findings };
  } catch (cause) {
    throw new RunnerError("Failed to run semantic checks", cause);
  }
}

function severityForCheck(check: string): "critical" | "major" | "minor" {
  switch (check) {
    case "missing-h1":
    case "input-no-label":
    case "interactive-no-text":
    case "img-no-alt": {
      return "major";
    }
    default: {
      return "minor";
    }
  }
}

function titleForCheck(check: string): string {
  switch (check) {
    case "missing-h1": {
      return "Missing h1 element";
    }
    case "multiple-h1": {
      return "Multiple h1 elements";
    }
    case "skipped-heading-level": {
      return "Skipped heading level";
    }
    case "interactive-no-text": {
      return "Interactive element without accessible text";
    }
    case "input-no-label": {
      return "Form input without associated label";
    }
    case "img-no-alt": {
      return "Image missing alt attribute";
    }
    case "fake-button-no-keyboard": {
      return "Custom button missing keyboard access";
    }
    default: {
      return check;
    }
  }
}

function recommendationForCheck(check: string): string {
  switch (check) {
    case "missing-h1": {
      return "Add a single h1 element that describes the page content.";
    }
    case "multiple-h1": {
      return "Use a single h1 per page. Demote extra h1 elements to h2 or lower.";
    }
    case "skipped-heading-level": {
      return "Use heading levels in sequential order without skipping levels.";
    }
    case "interactive-no-text": {
      return "Add visible text, an aria-label, or a title attribute to the element.";
    }
    case "input-no-label": {
      return "Associate a label element with each form input using the for attribute.";
    }
    case "img-no-alt": {
      return 'Add a descriptive alt attribute to the image, or alt="" if decorative.';
    }
    case "fake-button-no-keyboard": {
      return 'Add tabindex="0" and keyboard event handlers to custom button elements.';
    }
    default: {
      return "Review and fix the semantic issue.";
    }
  }
}

function mapSemanticResultToFindings(result: SemanticCheckResult, pageUrl: string): Finding[] {
  return result.issues.map((issue) => ({
    id: `semantic-${result.check}`,
    category: "semantic" as const,
    severity: severityForCheck(result.check),
    effort: "low" as const,
    rule_id: `semantic/${result.check}`,
    title: titleForCheck(result.check),
    description: issue.detail,
    recommendation: recommendationForCheck(result.check),
    selector: issue.selector,
    wcag: null,
    impact: null,
    source: null,
    url: pageUrl,
  }));
}

export { runSemanticChecks };
export type { SemanticRunnerResult };
