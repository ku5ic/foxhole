import type { CheckCategory, Finding, Fix, Severity } from "../types/index.js";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 1,
  major: 2,
  minor: 3,
};

function groupKey(finding: Finding): string {
  return `${finding.category}:${finding.severity}`;
}

function titleForGroup(category: CheckCategory, severity: Severity, count: number): string {
  const categoryLabel: Record<CheckCategory, string> = {
    perf: "performance",
    a11y: "accessibility",
    semantic: "semantic HTML",
    bundle: "bundle",
  };

  return `Fix ${String(count)} ${severity} ${categoryLabel[category]} ${count === 1 ? "issue" : "issues"}`;
}

function prioritizeFindings(findings: Finding[]): Fix[] {
  const groups = new Map<string, Finding[]>();

  for (const finding of findings) {
    const key = groupKey(finding);
    const existing = groups.get(key);
    if (existing) {
      existing.push(finding);
    } else {
      groups.set(key, [finding]);
    }
  }

  const fixes: Fix[] = [];

  for (const groupFindings of groups.values()) {
    const first = groupFindings[0];
    if (!first) continue;

    fixes.push({
      rank: SEVERITY_RANK[first.severity],
      finding_ids: groupFindings.map((f) => f.id),
      title: titleForGroup(first.category, first.severity, groupFindings.length),
      description: `${String(groupFindings.length)} ${first.severity} ${first.category === "a11y" ? "accessibility" : first.category} finding${groupFindings.length === 1 ? "" : "s"} that should be addressed.`,
      effort: first.effort,
      severity: first.severity,
      category: first.category,
    });
  }

  fixes.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.finding_ids.length - a.finding_ids.length;
  });

  let rank = 1;
  for (const fix of fixes) {
    fix.rank = rank;
    rank += 1;
  }

  return fixes;
}

export { prioritizeFindings };
