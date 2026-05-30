import { z } from "zod";

import { buildAuditReport } from "../../audit/index.js";
import { DEFAULT_CHECKS } from "../../config/defaults.js";
import type { CheckCategory } from "../../types/index.js";

const inputSchema = z.object({
  url: z.url().optional(),
  urls: z.string().optional(),
  checks: z.string().optional(),
  threshold: z.number().min(0).max(100).optional(),
});

type RunFullAuditInput = z.infer<typeof inputSchema>;

function parseUrls(input: RunFullAuditInput): string[] {
  if (input.url) return [input.url];
  if (input.urls) return input.urls.split(",").map((s) => s.trim());
  return [];
}

function parseChecks(input: RunFullAuditInput): CheckCategory[] {
  if (input.checks) return input.checks.split(",").map((s) => s.trim()) as CheckCategory[];
  return [...DEFAULT_CHECKS];
}

const runFullAuditTool = {
  name: "run_full_audit",
  description:
    "Run a full frontend audit against one or more URLs. Returns a complete AuditReport with findings, scores, and prioritized fixes.",
  inputSchema,
  handler: async (input: RunFullAuditInput): Promise<string> => {
    const urls = parseUrls(input);
    const checks = parseChecks(input);
    const report = await buildAuditReport({
      urls,
      checks,
      quiet: true,
      threshold: input.threshold,
      throttling: "none",
      inputMode: "url",
      concurrency: 1,
      perfRuns: 1,
      sourceMaps: "auto",
    });
    return JSON.stringify(report);
  },
};

export { runFullAuditTool };
