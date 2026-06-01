import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";
import { resolveMcpAuditOptions } from "../../config/resolve-mcp-options.js";

const inputSchema = z.object({
  url: z.url().optional(),
  urls: z.string().optional(),
  config: z.string().optional(),
});

type RunPerformanceAuditInput = z.infer<typeof inputSchema>;

const runPerformanceAuditTool = {
  name: "run_performance_audit",
  description:
    "Run a performance-only audit against a URL. Returns category summary, metrics, and performance findings.",
  inputSchema,
  handler: async (input: RunPerformanceAuditInput): Promise<string> => {
    const resolved = await resolveMcpAuditOptions(input, ["perf"]);
    const report = await buildAuditReport({
      urls: resolved.urls,
      checks: ["perf"],
      quiet: true,
      throttling: resolved.throttling,
      inputMode: resolved.inputMode,
      concurrency: resolved.concurrency,
      perfRuns: 1,
      sourceMaps: "auto",
      excludeFramework: resolved.excludeFramework,
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
