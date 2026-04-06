# Foxhole

Frontend audit CLI and MCP server. Audits URLs, local builds, and SPA route lists for accessibility violations, performance regressions, semantic HTML issues, and bundle problems. Wraps Lighthouse and axe-core with prioritized findings, scoring, narrative output, and MCP tooling.

## Stack

- Runtime: Node.js 18+
- Language: TypeScript (strict)
- Browser automation: Playwright
- Accessibility: axe-core
- Performance: Lighthouse CI
- CLI: Commander.js
- Validation: Zod
- Tests: Vitest

## Repository map

```
src/
  cli/              CLI entry point and command handlers
  runner/           Audit runners (Playwright, Lighthouse, axe-core, semantic, bundle)
  audit/            Scoring, prioritization, summarization, diff
  server/           Local static server for --build mode
  report/           Markdown renderer only.
  mcp/              MCP server and tool definitions
  config/           Config loading, defaults, Zod schema
  types/            Canonical schema types — source of truth for all data shapes

tests/
  runner/           Runner unit tests
  audit/            Audit logic unit tests
  report/           Renderer snapshot and unit tests
  fixtures/         JSON fixtures for complex test inputs

bin/
  foxhole.js        Executable shim

dist/               Compiled output, gitignored
```

## Workflow

Every task follows this command sequence without exception:

1. `/cmd-preflight` - Verify context, identify relevant skills, flag risks
2. `/cmd-plan` - Write a specific implementation plan before touching code
3. `/cmd-implement` - Execute the plan
4. `/cmd-test` - Write tests for everything implemented
5. `/cmd-review` - Review against the full quality checklist

Do not skip steps. Do not combine steps. If a plan has unresolved open questions, stop at cmd-plan and ask.

## Skills

Load the relevant skill before working in each area. Skills contain the decisions that must be consistent across every session.

| Area                                              | Skill                 |
| ------------------------------------------------- | --------------------- |
| Any new or modified module                        | typescript-module     |
| Any runner file in src/runner/                    | finding-normalization |
| Any function that can fail                        | error-handling        |
| Any file in src/cli/commands/                     | cli-command           |
| Any file in src/mcp/tools/                        | mcp-tool              |
| Any test file                                     | test-patterns         |
| Any code touching URLs, file paths, or user input | security              |
| src/report/markdown.ts                            | markdown-report       |

## Architecture rules

These are non-negotiable and apply to every task.

- Runners run. Scorers score. Renderers render. No cross-cutting logic.
- axe-core and Lighthouse are imported only in src/runner/.
- Playwright is imported only in src/runner/browser.ts.
- MCP tools delegate to src/audit/, never directly to src/runner/.
- CLI commands are thin. No business logic in command files.
- The canonical types live in src/types/index.ts. Do not redefine them locally.
- No default exports anywhere in the codebase.
- No `any`. No non-null assertions. Explicit return types on every function.

## Data flow

```
CLI flags / MCP input
        |
   config/load.ts        (merge flags + config file + defaults)
        |
   audit/index.ts        (orchestrate runners per page)
        |
   runner/index.ts       (run Lighthouse, axe, semantic, bundle)
        |
   Finding[]             (normalized, typed, stable IDs)
        |
   audit/score.ts        (score per category and overall)
   audit/prioritize.ts   (rank findings into Fix[])
   audit/summarize.ts    (narrative paragraph)
        |
   AuditReport           (canonical output shape)
        |
   report/markdown.ts    (human output, free tier only)
   stdout / file         (CLI)
   MCP tool return       (agent output)
```

## Schema

The canonical schema is in src/types/index.ts. Read it before any task that touches data shapes. Never deviate from the schema without an explicit instruction to change it. Schema changes are breaking changes.

Key types: `Finding`, `Fix`, `CategorySummary`, `PerformanceMetrics`, `PageResult`, `RunMeta`, `AuditReport`, `RunDiff`.

## Exit codes

- `0` audit passed
- `1` audit completed, score below threshold
- `2` runtime error, config error, or unexpected failure

## Output rules

- No em dashes, no smart quotes, plain ASCII punctuation only
- No AI tells of any kind in any output, report content, or error messages
- Code is idiomatic TypeScript, explicit over clever
- Meaningful names, no abbreviations except well-known ones (url, ms, cli)
- Flag technical debt and risks explicitly rather than silently working around them

## Monetization boundary

The --push flag is the boundary between the free CLI and the hosted layer. Nothing in the current codebase implements --push. Do not build toward it without explicit instruction.

## Common gotchas

- Playwright must wait for networkidle plus 500ms before handing the page to axe-core or Lighthouse. Do not skip the buffer.
- Finding IDs must be stable across runs. Never use random or timestamp-based IDs.
- Progress output goes to stderr. Report output goes to stdout.
- Selectors from axe-core must be sanitized before appearing in any output.
- Config file values are always overridden by CLI flags. Merge order matters.
- The `summary` field in AuditReport is a narrative paragraph, not a bullet list.
