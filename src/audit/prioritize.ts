import { catalog } from "../catalog/index.js";
import type { Effort, Finding, Fix, Severity } from "../types/index.js";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 1,
  major: 2,
  minor: 3,
};

const EFFORT_RANK: Record<Effort, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

function prioritizeFindings(findings: Finding[]): Fix[] {
  const groups = new Map<string, Finding[]>();

  for (const finding of findings) {
    const existing = groups.get(finding.rule_id);
    if (existing) {
      existing.push(finding);
    } else {
      groups.set(finding.rule_id, [finding]);
    }
  }

  const fixes: Fix[] = [];

  for (const groupFindings of groups.values()) {
    const first = groupFindings[0];
    if (!first) continue;

    const count = groupFindings.length;
    const entry = catalog[first.rule_id];
    const categoryLabel = first.category === "a11y" ? "accessibility" : first.category;

    // Use the most severe finding's severity/effort so the fix rank reflects the worst case,
    // not whichever finding happened to arrive first.
    let severity: Severity = first.severity;
    let effort: Effort = first.effort;
    for (const f of groupFindings) {
      if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[severity]) severity = f.severity;
      if (EFFORT_RANK[f.effort] < EFFORT_RANK[effort]) effort = f.effort;
    }

    fixes.push({
      rank: SEVERITY_RANK[severity],
      finding_ids: groupFindings.map((f) => f.id),
      rule_id: first.rule_id,
      title: entry?.title_template ?? first.title,
      description: `${String(count)} ${severity} ${categoryLabel} ${count === 1 ? "finding" : "findings"} that should be addressed.`,
      effort,
      severity,
      category: first.category,
      pages_affected: [...new Set(groupFindings.map((f) => f.url))],
    });
  }

  fixes.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.finding_ids.length !== a.finding_ids.length) {
      return b.finding_ids.length - a.finding_ids.length;
    }
    return a.rule_id.localeCompare(b.rule_id);
  });

  let rank = 1;
  for (const fix of fixes) {
    fix.rank = rank;
    rank += 1;
  }

  return fixes;
}

export { prioritizeFindings };
