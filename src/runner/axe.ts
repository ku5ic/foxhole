import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import type { Page } from "playwright";

import { RunnerError } from "../errors.js";
import { catalogLookup } from "./catalog-lookup.js";
import { buildSemanticPath, buildTextFingerprint, computeFindingId } from "./finding-id.js";
import { sanitizeSelector } from "./sanitize.js";
import type { Finding, Severity } from "../types/index.js";

interface AxeRunnerResult {
  findings: Finding[];
}

interface AxeViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
}

interface AxeNode {
  target: string[];
  html: string;
}

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "critical",
  serious: "critical",
  moderate: "major",
  minor: "minor",
};

function mapAxeImpactToSeverity(impact: string | undefined): Severity {
  if (!impact) return "major";
  return SEVERITY_MAP[impact] ?? "major";
}

function extractWcag(tags: string[]): string | null {
  for (const tag of tags) {
    if (!/^wcag\d+$/.test(tag)) continue;
    const digits = tag.slice(4);
    if (digits.length < 3) continue;
    const major = digits[0];
    const minor = digits[1];
    const clause = digits.slice(2);
    if (major && minor) return `${major}.${minor}.${clause}`;
  }
  return null;
}

function mapAxeViolationToFindings(violation: AxeViolation, pageUrl: string): Finding[] {
  const ruleId = `a11y/${violation.id}`;
  const entry = catalogLookup(ruleId);

  const severity = entry ? entry.default_severity : mapAxeImpactToSeverity(violation.impact);
  const effort = entry ? entry.default_effort : ("medium" as const);
  const wcag = entry ? entry.wcag : extractWcag(violation.tags);
  const title = entry ? entry.title_template : violation.help;
  const description = entry ? entry.description_template : violation.description;
  const recommendation = entry
    ? entry.recommendation
    : `Review this issue using axe-core documentation: ${violation.helpUrl}`;

  if (violation.nodes.length === 0) {
    const textFingerprint = buildTextFingerprint({ ruleId: violation.id, detail: "" });
    const id = computeFindingId({ pageUrl, ruleId, semanticPath: "", textFingerprint });
    return [
      {
        id,
        category: "a11y",
        severity,
        effort,
        rule_id: ruleId,
        title,
        description,
        recommendation,
        selector: null,
        wcag,
        impact: violation.impact ?? null,
        source: null,
        url: pageUrl,
      },
    ];
  }

  return violation.nodes.map((node) => {
    const selectorRaw = node.target[0];
    const selector = selectorRaw === undefined ? null : sanitizeSelector(selectorRaw);
    const semanticPath = buildSemanticPath(node.html);
    const textFingerprint = buildTextFingerprint({
      ruleId: violation.id,
      detail: selectorRaw ?? "",
    });
    const id = computeFindingId({ pageUrl, ruleId, semanticPath, textFingerprint });
    return {
      id,
      category: "a11y" as const,
      severity,
      effort,
      rule_id: ruleId,
      title,
      description,
      recommendation,
      selector,
      wcag,
      impact: violation.impact ?? null,
      source: null,
      url: pageUrl,
    };
  });
}

async function runAxe(page: Page, pageUrl: string): Promise<AxeRunnerResult> {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const axeSourcePath = path.resolve(
    __dirname,
    "..",
    "..",
    "node_modules",
    "axe-core",
    "axe.min.js",
  );
  const axeSource = fs.readFileSync(axeSourcePath, "utf8");

  try {
    await page.addScriptTag({ content: axeSource });

    const rawViolations: unknown = await page.evaluate(`
      (async () => {
        const result = await window.axe.run();
        return result.violations;
      })()
    `);

    const violations = rawViolations as AxeViolation[];
    const findings = violations.flatMap((violation) =>
      mapAxeViolationToFindings(violation, pageUrl),
    );

    return { findings };
  } catch (cause) {
    throw new RunnerError("Failed to run axe-core against target page", cause);
  }
}

export { runAxe, mapAxeViolationToFindings, sanitizeSelector };
export type { AxeRunnerResult, AxeViolation, AxeNode };
