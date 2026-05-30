import { z } from "zod";

import { diffReports } from "../../audit/diff.js";
import { auditReportSchema } from "../../types/schema.js";
import { ConfigError } from "../../errors.js";

const inputSchema = z.object({
  before_json: z.string(),
  after_json: z.string(),
});

type CompareRunsInput = z.infer<typeof inputSchema>;

function parseReport(json: string, label: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (cause) {
    throw new ConfigError(`${label} is not valid JSON`, cause);
  }

  const result = auditReportSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid AuditReport in ${label}: ${issues}`);
  }

  return result.data;
}

const compareRunsTool = {
  name: "compare_runs",
  description:
    "Compare two audit runs. Accepts two serialized AuditReport JSON strings and returns a RunDiff showing regressions, improvements, and score changes.",
  inputSchema,
  handler: (input: CompareRunsInput): string => {
    const before = parseReport(input.before_json, "before_json");
    const after = parseReport(input.after_json, "after_json");
    const diff = diffReports(before, after);
    return JSON.stringify(diff);
  },
};

export { compareRunsTool };
