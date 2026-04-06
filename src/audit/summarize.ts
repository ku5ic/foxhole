import type { PageResult } from "../types/index.js";

function summarizeReport(pages: PageResult[], score: number): string {
  const pageCount = pages.length;
  const allFindings = pages.flatMap((p) => p.findings);
  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const majorCount = allFindings.filter((f) => f.severity === "major").length;
  const minorCount = allFindings.filter((f) => f.severity === "minor").length;
  const totalCount = allFindings.length;

  const parts: string[] = [
    `Audited ${String(pageCount)} ${pageCount === 1 ? "page" : "pages"} with an overall score of ${String(score)} out of 100.`,
  ];

  if (totalCount === 0) {
    parts.push("No issues were found.");
  } else {
    parts.push(
      `Found ${String(totalCount)} ${totalCount === 1 ? "issue" : "issues"}: ${String(criticalCount)} critical, ${String(majorCount)} major, ${String(minorCount)} minor.`,
    );
  }

  if (criticalCount > 0) {
    parts.push(
      `This build has ${String(criticalCount)} critical ${criticalCount === 1 ? "issue" : "issues"} that ${criticalCount === 1 ? "requires" : "require"} immediate attention.`,
    );
  } else {
    parts.push("This build passes the configured threshold.");
  }

  return parts.join(" ");
}

export { summarizeReport };
