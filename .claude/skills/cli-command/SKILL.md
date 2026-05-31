---
name: cli-command
description: CLI command scaffold and conventions for foxhole. Use whenever working in src/cli/commands/ or src/cli/options.ts, OR the user asks about adding CLI flags, command handlers, output dispatch, or exit code mapping in this project.
metadata:
  type: project
---

# Skill: CLI command scaffold

Every CLI command in Foxhole follows the same structure. Commands are thin. They parse and validate input, delegate to the audit or report layer, handle output, and map results to exit codes. No business logic lives in a command file.

## Command file structure

```typescript
import { Command } from "commander";

import { loadConfig } from "../../config/load.js";
import { runAudit } from "../../audit/index.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import type { AuditReport } from "../../types/index.js";

function createRunCommand(): Command {
  const command = new Command("run");

  command
    .description("Run a frontend audit against a URL or local build")
    .option("--url <url>", "target URL")
    .option("--urls <urls>", "comma-separated list of URLs or paths")
    .option("--build <path>", "path to static build directory")
    .option("--checks <checks>", "comma-separated checks: perf,a11y,semantic,bundle")
    .option("--output <format>", "output format: json | markdown", "markdown")
    .option("--out <path>", "file path for output")
    .option("--config <path>", "path to foxhole.config.json")
    .option("--threshold <n>", "fail if score drops below this value", Number.parseFloat)
    .option("--throttling <preset>", "Lighthouse throttling preset: desktop, mobile, or none")
    .option("--concurrency <n>", "number of URLs to audit in parallel", Number.parseInt)
    .option("--exclude-framework", "exclude framework findings from score computation")
    .option("--quiet", "suppress progress output")
    .action(async (options) => {
      await handleRun(options);
    });

  return command;
}

async function handleRun(options: RunOptions): Promise<void> {
  // 1. Load and validate config
  // 2. Delegate to audit layer
  // 3. Dispatch output
  // 4. Handle exit code
}

export { createRunCommand };
```

## Responsibility rules

Commands are responsible for:

- Parsing CLI flags into a typed options object
- Loading and merging config file options
- Validating that required options are present
- Delegating to the correct audit or report function
- Writing output to stdout or a file
- Mapping results to the correct exit code
- Printing clean, user-facing error messages

Commands are not responsible for:

- Running Playwright, Lighthouse, or axe-core
- Scoring, prioritizing, or summarizing findings
- Rendering report content beyond dispatching to a renderer
- Any logic that belongs in `src/audit/`, `src/runner/`, or `src/report/`

## Option validation pattern

Validate options at the start of the handler before doing any async work.

```typescript
async function handleRun(options: RunOptions): Promise<void> {
  const hasInput = options.url || options.urls || options.build;

  if (!hasInput) {
    console.error("Error: one of --url, --urls, or --build is required");
    process.exit(2);
  }

  if (options.build && !options.urls) {
    console.error("Error: --build requires --urls");
    process.exit(2);
  }
}
```

## Config merging order

CLI flags take precedence over config file values. Merge in this order:

1. Default values from `src/config/defaults.ts`
2. Config file values (if `--config` is provided or `foxhole.config.json` exists)
3. CLI flag values (always win)

## Output dispatch pattern

```typescript
async function writeOutput(
  report: AuditReport,
  format: "json" | "markdown",
  outPath: string | undefined,
): Promise<void> {
  const content =
    format === "json" ? JSON.stringify(report, null, 2) : renderMarkdownReport(report);

  if (outPath) {
    await fs.writeFile(outPath, content, "utf8");
  } else {
    process.stdout.write(content);
  }
}
```

## Progress output

When `--quiet` is not set, print progress to stderr, not stdout. Stdout is reserved for report output.

```typescript
function log(message: string, quiet: boolean): void {
  if (!quiet) {
    process.stderr.write(`${message}\n`);
  }
}
```

## Exit code mapping

```typescript
function resolveExitCode(report: AuditReport): number {
  if (report.meta.threshold !== null && !report.meta.passed) return 1;
  return 0;
}
```

Runtime errors always exit with code 2. Handle them in the top-level error handler, not inside command handlers.

## Anti-patterns

**failure**: Putting business logic in a command file. If a handler does more than parse, delegate, dispatch, and exit -- it belongs in `src/audit/`, `src/runner/`, or `src/report/`.

**failure**: Writing output to stdout AND calling `process.exit(1)` without dispatching first. Always write the report before exiting.

**warning**: Validating options after starting async work. Validate at the top of the handler before any `await`.

**warning**: Using `console.log` for report output. Use `process.stdout.write` to avoid the trailing newline `console.log` adds.

**info**: Missing explicit `Number.parseInt` or `Number.parseFloat` as the third argument to `.option()` for numeric flags. Commander passes string values; without the coercion function, `options.threshold` is a string.

## When to load this skill

- Adding or modifying any file in `src/cli/commands/`
- Adding a new CLI flag to `src/cli/options.ts`
- Debugging exit code behavior or option validation

## When not to load this skill

- Working in `src/audit/`, `src/runner/`, `src/report/`, or `src/mcp/`
- Reading CLI code to understand behavior without making changes

## References

- `src/cli/commands/run.ts` -- canonical command implementation
- `src/cli/options.ts` -- shared option definitions
- `src/config/schema.ts` -- valid output formats (`"json" | "markdown"`)
- `docs/spec/v1.md` section 5 -- input mode rules and mutual exclusion
- `docs/spec/schemas.md` section 9 -- RunMeta fields including `exclude_framework`
