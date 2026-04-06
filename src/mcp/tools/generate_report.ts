import { z } from "zod";

import { renderMarkdownReport } from "../../report/markdown.js";
import type { AuditReport } from "../../types/index.js";

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
    const report = JSON.parse(input.report_json) as AuditReport;
    if (input.format === "json") {
      return JSON.stringify(report, null, 2);
    }
    return renderMarkdownReport(report);
  },
};

export { generateReportTool };
