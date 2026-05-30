import { z } from "zod";

import { prioritizeFindings } from "../../audit/prioritize.js";
import { auditReportSchema } from "../../types/schema.js";
import { ConfigError } from "../../errors.js";

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
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.report_json) as unknown;
    } catch (cause) {
      throw new ConfigError("report_json is not valid JSON", cause);
    }

    const result = auditReportSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new ConfigError(`Invalid AuditReport: ${issues}`);
    }

    const allFindings = result.data.pages.flatMap((p) => p.findings);
    const fixes = prioritizeFindings(allFindings);
    return JSON.stringify(fixes);
  },
};

export { getPrioritizedFixesTool };
