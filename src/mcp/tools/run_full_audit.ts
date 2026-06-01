import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";
import { resolveMcpAuditOptions } from "../../config/resolve-mcp-options.js";

const inputSchema = z.object({
  url: z.url().optional(),
  urls: z.string().optional(),
  checks: z.string().optional(),
  threshold: z.number().min(0).max(100).optional(),
  config: z.string().optional(),
});

type RunFullAuditInput = z.infer<typeof inputSchema>;

const runFullAuditTool = {
  name: "run_full_audit",
  description:
    "Run a full frontend audit against one or more URLs. Returns a complete AuditReport with findings, scores, and prioritized fixes.",
  inputSchema,
  handler: async (input: RunFullAuditInput): Promise<string> => {
    const resolved = await resolveMcpAuditOptions(input);
    const report = await buildAuditReport({
      urls: resolved.urls,
      checks: resolved.checks,
      quiet: true,
      threshold: resolved.threshold,
      throttling: resolved.throttling,
      inputMode: resolved.inputMode,
      concurrency: resolved.concurrency,
      perfRuns: 1,
      sourceMaps: "auto",
      excludeFramework: resolved.excludeFramework,
    });
    return JSON.stringify(report);
  },
};

export { runFullAuditTool };
