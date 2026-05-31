---
name: mcp-tool
description: MCP tool scaffold and conventions for foxhole. Use whenever working in src/mcp/tools/, OR the user asks about adding MCP tools, input schemas, tool registration, or error surface for MCP in this project.
metadata:
  type: project
---

# Skill: MCP tool scaffold

Every MCP tool in Foxhole follows the same structure. Tools are thin wrappers that validate input, delegate to the audit layer, and return structured JSON. They share the same core runners as the CLI. No business logic is duplicated.

## Tool file structure

```typescript
import { z } from "zod";

import { runAudit } from "../../audit/index.js";
import type { AuditReport } from "../../types/index.js";

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
  inputSchema,
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

## Tool registration

```typescript
import { tool as runFullAudit } from "./tools/run_full_audit.js";
import { tool as runAccessibilityAudit } from "./tools/run_accessibility_audit.js";

const tools = [runFullAudit, runAccessibilityAudit];
```

## Tool definitions

| Tool name                 | Input                                   | Returns                                 |
| ------------------------- | --------------------------------------- | --------------------------------------- |
| `run_full_audit`          | url, checks?, threshold?                | AuditReport                             |
| `run_accessibility_audit` | url                                     | Finding[] (a11y only)                   |
| `run_performance_audit`   | url                                     | CategorySummary + Finding[] (perf only) |
| `get_prioritized_fixes`   | report: AuditReport                     | Fix[]                                   |
| `compare_runs`            | before: AuditReport, after: AuditReport | RunDiff                                 |
| `generate_report`         | report: AuditReport, format?: string    | string                                  |

## Input validation rules

- Always validate input with Zod before passing to the audit layer.
- Return a structured validation error if input is invalid; do not throw.
- URL inputs must be validated as valid URLs via `z.string().url()`.
- Never trust that the MCP caller has passed the correct types.

## Error surface

MCP tools surface errors as structured objects, not thrown exceptions.

```typescript
type ToolResult<T> = { success: true; data: T } | { success: false; error: string; code: string };
```

Catch typed `FoxholeError` subclasses from the audit layer and convert them to `ToolResult` failure objects. Let unexpected errors propagate to the MCP server's top-level handler.

## Anti-patterns

**failure**: Calling `src/runner/` directly from a tool. Tools must delegate to `src/audit/`, never to runners. This preserves the audit layer's scoring, prioritization, and error isolation.

**failure**: Throwing from a tool handler for a known failure mode. Validation errors and audit failures must return as `ToolResult` errors, not exceptions.

**warning**: Loose input schemas. Do not accept `z.string()` where `z.string().url()` is possible. Prefer narrow types.

**warning**: Duplicating business logic that already exists in the CLI path. Tools and CLI commands share the same audit layer; they should not diverge in behavior.

**info**: Tool descriptions that are too generic for agent selection. "Run an audit" is worse than "Run a full Lighthouse + axe-core audit and return a scored AuditReport with prioritized fixes."

## When to load this skill

- Adding or modifying any file in `src/mcp/tools/`
- Modifying `src/mcp/index.ts` tool registration
- Debugging MCP tool input validation or error responses

## When not to load this skill

- Working in `src/cli/`, `src/audit/`, `src/runner/`, or `src/report/`
- Reviewing MCP tool definitions without making changes

## References

- `src/mcp/tools/` -- all tool implementations
- `src/mcp/index.ts` -- tool registration
- `src/types/index.ts` -- `AuditReport`, `Finding`, `Fix`, `RunDiff` types
- `docs/spec/v1.md` section 7 -- MCP tool definitions and expected inputs/outputs
