import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";
import type { Finding } from "../../types/index.js";

const inputSchema = z.object({
  url: z.url(),
});

type RunAccessibilityAuditInput = z.infer<typeof inputSchema>;

const runAccessibilityAuditTool = {
  name: "run_accessibility_audit",
  description:
    "Run an accessibility-only audit against a URL. Returns the list of accessibility findings.",
  inputSchema,
  handler: async (input: RunAccessibilityAuditInput): Promise<string> => {
    const report = await buildAuditReport({
      urls: [input.url],
      checks: ["a11y"],
      quiet: true,
      throttling: "none",
      inputMode: "url",
      concurrency: 1,
      perfRuns: 1,
      sourceMaps: "auto",
    });
    const findings: Finding[] = report.pages.flatMap((p) => p.findings);
    return JSON.stringify(findings);
  },
};

export { runAccessibilityAuditTool };
