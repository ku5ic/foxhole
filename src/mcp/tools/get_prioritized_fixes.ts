import { z } from "zod";

import { prioritizeFindings } from "../../audit/prioritize.js";
import type { AuditReport } from "../../types/index.js";

const inputSchema = z.object({
  report_json: z.string(),
});

type GetPrioritizedFixesInput = z.infer<typeof inputSchema>;

const getPrioritizedFixesTool = {
  name: "get_prioritized_fixes",
  description:
    "Accept a serialized AuditReport JSON string, extract all findings, and return a prioritized list of fixes ranked by severity and impact.",
  inputSchema,
  handler: (input: GetPrioritizedFixesInput): string => {
    const report = JSON.parse(input.report_json) as AuditReport;
    const allFindings = report.pages.flatMap((p) => p.findings);
    const fixes = prioritizeFindings(allFindings);
    return JSON.stringify(fixes);
  },
};

export { getPrioritizedFixesTool };
