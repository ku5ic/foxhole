import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";

const inputSchema = z.object({
  url: z.url(),
});

type RunPerformanceAuditInput = z.infer<typeof inputSchema>;

const runPerformanceAuditTool = {
  name: "run_performance_audit",
  description:
    "Run a performance-only audit against a URL. Returns category summary, metrics, and performance findings.",
  inputSchema,
  handler: async (input: RunPerformanceAuditInput): Promise<string> => {
    const report = await buildAuditReport({
      urls: [input.url],
      checks: ["perf"],
      quiet: true,
      throttling: "none",
    });
    const page = report.pages[0];
    const result = {
      categories: page?.categories ?? [],
      findings: page?.findings ?? [],
      metrics: page?.metrics ?? null,
    };
    return JSON.stringify(result);
  },
};

export { runPerformanceAuditTool };
