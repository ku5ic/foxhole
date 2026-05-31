import type { Page } from "playwright";

import { z } from "zod";

import { RunnerError } from "../errors.js";
import { catalogLookup } from "./catalog-lookup.js";
import { buildSemanticPath, buildTextFingerprint, computeFindingId } from "./finding-id.js";
import { sanitizeSelector } from "./sanitize.js";
import type { Finding } from "../types/index.js";

interface SemanticRunnerResult {
  findings: Finding[];
}

interface SemanticCheckResult {
  check: string;
  issues: { selector: string | null; detail: string; outerHTML: string | null }[];
}

const semanticIssueSchema = z.object({
  selector: z.string().nullable(),
  detail: z.string(),
  outerHTML: z.string().nullable(),
});

const semanticCheckResultSchema = z.object({
  check: z.string(),
  issues: z.array(semanticIssueSchema),
});

const semanticResultsSchema = z.array(semanticCheckResultSchema);

function parseSemanticResults(raw: unknown): SemanticCheckResult[] {
  const result = semanticResultsSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const detail = issue ? `${issue.path.join(".") || "root"}: ${issue.message}` : "unknown";
    throw new RunnerError(`Unexpected semantic check output shape: ${detail}`);
  }
  return result.data;
}

const SEMANTIC_CHECKS_SCRIPT = `(() => {
  const checks = [];

  const h1s = document.querySelectorAll("h1");
  if (h1s.length === 0) {
    checks.push({ check: "missing-h1", issues: [{ selector: null, detail: "Page has no h1 element", outerHTML: null }] });
  } else if (h1s.length > 1) {
    checks.push({
      check: "multiple-h1",
      issues: Array.from(h1s).slice(1).map(el => ({
        selector: el.tagName.toLowerCase(),
        detail: "Page has " + h1s.length + " h1 elements",
        outerHTML: el.outerHTML.slice(0, 500)
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
        issues: [{ selector: heading.tagName.toLowerCase(), detail: "Heading level skipped from h" + prevLevel + " to h" + level, outerHTML: heading.outerHTML.slice(0, 500) }]
      });
    }
    prevLevel = level;
  }

  const interactives = document.querySelectorAll("button, a");
  const noText = [];
  for (const el of interactives) {
    const text = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (text === "") {
      noText.push({ selector: el.tagName.toLowerCase(), detail: el.tagName.toLowerCase() + " has no accessible text", outerHTML: el.outerHTML.slice(0, 500) });
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
      unlabeled.push({ selector: input.tagName.toLowerCase(), detail: "Form input has no associated label", outerHTML: input.outerHTML.slice(0, 500) });
    }
  }
  if (unlabeled.length > 0) checks.push({ check: "input-no-label", issues: unlabeled });

  const images = document.querySelectorAll("img");
  const noAlt = [];
  for (const img of images) {
    if (!img.hasAttribute("alt")) {
      noAlt.push({ selector: "img", detail: "Image has no alt attribute", outerHTML: img.outerHTML.slice(0, 500) });
    }
  }
  if (noAlt.length > 0) checks.push({ check: "img-no-alt", issues: noAlt });

  const fakeButtons = document.querySelectorAll('div[role="button"], span[role="button"]');
  const noKeyboard = [];
  for (const el of fakeButtons) {
    if (!el.hasAttribute("tabindex")) {
      noKeyboard.push({ selector: el.tagName.toLowerCase() + '[role="button"]', detail: "Element with role=button has no tabindex for keyboard access", outerHTML: el.outerHTML.slice(0, 500) });
    }
  }
  if (noKeyboard.length > 0) checks.push({ check: "fake-button-no-keyboard", issues: noKeyboard });

  return checks;
})()`;

function mapSemanticResultToFindings(result: SemanticCheckResult, pageUrl: string): Finding[] {
  const ruleId = `semantic/${result.check}`;
  const entry = catalogLookup(ruleId);

  return result.issues.map((issue) => {
    const semanticPath = issue.outerHTML === null ? "" : buildSemanticPath(issue.outerHTML);
    const textFingerprint = buildTextFingerprint({ ruleId: result.check, detail: issue.detail });
    const id = computeFindingId({ pageUrl, ruleId, semanticPath, textFingerprint });

    return {
      id,
      category: "semantic" as const,
      severity: entry ? entry.default_severity : ("minor" as const),
      effort: entry ? entry.default_effort : ("low" as const),
      rule_id: ruleId,
      title: entry ? entry.title_template : result.check,
      description: issue.detail,
      recommendation: entry ? entry.recommendation : "Review and fix the semantic issue.",
      selector: issue.selector === null ? null : sanitizeSelector(issue.selector),
      wcag: null,
      impact: null,
      source: null,
      url: pageUrl,
    };
  });
}

async function runSemanticChecks(page: Page, pageUrl: string): Promise<SemanticRunnerResult> {
  try {
    const rawResults: unknown = await page.evaluate(SEMANTIC_CHECKS_SCRIPT);
    const results = parseSemanticResults(rawResults);

    const findings = results.flatMap((result) => mapSemanticResultToFindings(result, pageUrl));

    return { findings };
  } catch (cause) {
    throw new RunnerError("Failed to run semantic checks", cause);
  }
}

export { runSemanticChecks, mapSemanticResultToFindings, parseSemanticResults };
export type { SemanticRunnerResult, SemanticCheckResult };
