import { z } from "zod";

import { diffReports } from "../../audit/diff.js";
import type { AuditReport } from "../../types/index.js";

const inputSchema = z.object({
  before_json: z.string(),
  after_json: z.string(),
});

type CompareRunsInput = z.infer<typeof inputSchema>;

const compareRunsTool = {
  name: "compare_runs",
  description:
    "Compare two audit runs. Accepts two serialized AuditReport JSON strings and returns a RunDiff showing regressions, improvements, and score changes.",
  inputSchema,
  handler: (input: CompareRunsInput): string => {
    const before = JSON.parse(input.before_json) as AuditReport;
    const after = JSON.parse(input.after_json) as AuditReport;
    const diff = diffReports(before, after);
    return JSON.stringify(diff);
  },
};

export { compareRunsTool };
