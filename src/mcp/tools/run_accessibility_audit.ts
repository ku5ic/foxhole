import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";
import { resolveMcpAuditOptions } from "../../config/resolve-mcp-options.js";
import type { Finding } from "../../types/index.js";

const inputSchema = z.object({
  url: z.url().optional(),
  urls: z.string().optional(),
  config: z.string().optional(),
});

type RunAccessibilityAuditInput = z.infer<typeof inputSchema>;

const runAccessibilityAuditTool = {
  name: "run_accessibility_audit",
  description:
    "Run an accessibility-only audit against a URL. Returns the list of accessibility findings.",
  inputSchema,
  handler: async (input: RunAccessibilityAuditInput): Promise<string> => {
    const resolved = await resolveMcpAuditOptions(input, ["a11y"]);
    const report = await buildAuditReport({
      urls: resolved.urls,
      checks: ["a11y"],
      quiet: true,
      throttling: resolved.throttling,
      inputMode: resolved.inputMode,
      concurrency: resolved.concurrency,
      perfRuns: 1,
      sourceMaps: "auto",
    });
    const findings: Finding[] = report.pages.flatMap((p) => p.findings);
    return JSON.stringify(findings);
  },
};

export { runAccessibilityAuditTool };
