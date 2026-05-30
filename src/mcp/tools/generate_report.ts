import { z } from "zod";

import { renderMarkdownReport } from "../../report/markdown.js";
import { auditReportSchema } from "../../types/schema.js";
import { ConfigError } from "../../errors.js";

const inputSchema = z.object({
  report_json: z.string(),
  format: z.enum(["json", "markdown"]).optional().default("markdown"),
});

type GenerateReportInput = z.infer<typeof inputSchema>;

const generateReportTool = {
  name: "generate_report",
  description:
    "Generate a human-readable report from a serialized AuditReport JSON string. Supports JSON and Markdown output formats.",
  inputSchema,
  handler: (input: GenerateReportInput): string => {
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

    if (input.format === "json") {
      return JSON.stringify(result.data, null, 2);
    }
    return renderMarkdownReport(result.data);
  },
};

export { generateReportTool };
