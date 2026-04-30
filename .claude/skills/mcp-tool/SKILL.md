# Skill: MCP tool scaffold

Every MCP tool in Foxhole follows the same structure. Tools are thin wrappers that validate input, delegate to the audit layer, and return structured JSON. They share the same core runners as the CLI. No business logic is duplicated.

## Tool file structure

```typescript
import { z } from "zod";

import { runAudit } from "../../audit/index.ts";
import type { AuditReport } from "../../types/index.ts";

const inputSchema = z.object({
  url: z.string().url(),
  checks: z.array(z.enum(["perf", "a11y", "semantic", "bundle"])).optional(),
  threshold: z.number().min(0).max(100).optional(),
});

type Input = z.infer<typeof inputSchema>;

const tool = {
  name: "run_full_audit",
  description:
    "Run a full frontend audit against a URL. Returns a complete AuditReport with findings, scores, and prioritized fixes.",
  inputSchema: inputSchema,
  handler: async (input: Input): Promise<AuditReport> => {
    return runAudit({
      url: input.url,
      checks: input.checks,
      threshold: input.threshold,
    });
  },
};

export { tool };
```

## Tool registration in src/mcp/index.ts

```typescript
import { tool as runFullAudit } from "./tools/run_full_audit.ts";
import { tool as runAccessibilityAudit } from "./tools/run_accessibility_audit.ts";

const tools = [
  runFullAudit,
  runAccessibilityAudit,
  // additional tools
];
```

## Tool definitions

| Tool name                 | Input                                    | Returns                                 |
| ------------------------- | ---------------------------------------- | --------------------------------------- |
| `run_full_audit`          | url, checks?, threshold?                 | AuditReport                             |
| `run_accessibility_audit` | url                                      | Finding[] (a11y only)                   |
| `run_performance_audit`   | url                                      | CategorySummary + Finding[] (perf only) |
| `get_prioritized_fixes`   | findings: Finding[]                      | Fix[]                                   |
| `compare_runs`            | before: AuditReport, after: AuditReport  | RunDiff                                 |
| `generate_report`         | report: AuditReport, format?: "markdown" | string                                  |

## Input validation rules

- Always validate input with Zod before passing to the audit layer.
- Return a typed validation error if input is invalid, do not throw.
- URL inputs must be validated as valid URLs.
- Never trust that the caller has passed the correct types.

## Error surface

MCP tools return errors as structured objects, not thrown exceptions.

```typescript
type ToolResult<T> = { success: true; data: T } | { success: false; error: string; code: string };
```

## Rules

- Tools delegate entirely to src/audit/ or src/report/. No runner calls directly from tools.
- Tool descriptions must be precise enough for an AI agent to select the correct tool without ambiguity.
- Input schemas must be as narrow as possible. Do not accept loose types.
- Tools are stateless. Each call is independent.
- No side effects beyond running the audit and returning the result.

## What never belongs in a tool file

- Direct calls to Playwright, Lighthouse, or axe-core.
- Scoring, prioritization, or normalization logic.
- File system operations.
- Any logic already present in the CLI commands.
