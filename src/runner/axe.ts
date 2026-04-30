import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import type { Page } from "playwright";

import { RunnerError } from "../errors.js";
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
  const wcagTags = tags.filter((tag) => /^wcag\d/.test(tag));
  if (wcagTags.length === 0) return null;

  for (const tag of wcagTags) {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (match?.[1] && match[2] && match[3]) {
      return `${match[1]}.${match[2]}.${match[3]}`;
    }
  }

  return null;
}

function sanitizeSelector(selector: string): string {
  return selector.replaceAll(/[<>]/g, "").slice(0, 200);
}

function mapAxeViolationToFindings(violation: AxeViolation, pageUrl: string): Finding[] {
  if (violation.nodes.length === 0) {
    return [
      {
        id: `a11y-${violation.id}`,
        category: "a11y",
        severity: mapAxeImpactToSeverity(violation.impact),
        // TODO: effort estimation will be improved in a later iteration
        effort: "medium",
        title: violation.help,
        description: violation.description,
        recommendation: violation.help,
        selector: null,
        wcag: extractWcag(violation.tags),
        impact: violation.impact ?? null,
        url: pageUrl,
      },
    ];
  }

  return violation.nodes.map((node) => ({
    id: `a11y-${violation.id}`,
    category: "a11y" as const,
    severity: mapAxeImpactToSeverity(violation.impact),
    // TODO: effort estimation will be improved in a later iteration
    effort: "medium" as const,
    title: violation.help,
    description: violation.description,
    recommendation: violation.help,
    selector: node.target[0] === undefined ? null : sanitizeSelector(node.target[0]),
    wcag: extractWcag(violation.tags),
    impact: violation.impact ?? null,
    url: pageUrl,
  }));
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

export { runAxe };
export type { AxeRunnerResult };
