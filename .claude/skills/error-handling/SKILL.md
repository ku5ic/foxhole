---
name: error-handling
description: Error handling conventions for the foxhole codebase. Use whenever writing any function that can fail, OR the user asks about error classes, exit codes, catch patterns, or Result type usage in this project.
metadata:
  type: project
---

# Skill: Error handling

Foxhole is a CLI tool and MCP server. Error handling must be explicit, typed, and consistent. Unhandled promise rejections and uncaught exceptions are not acceptable.

## Error classes

All error classes live in `src/errors.ts`. They extend `FoxholeError`.

```typescript
class FoxholeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FoxholeError";
  }
}

class ConfigError extends FoxholeError {
  /* code: "CONFIG_ERROR" */
}
class RunnerError extends FoxholeError {
  /* code: "RUNNER_ERROR" */
}
class NetworkError extends FoxholeError {
  /* code: "NETWORK_ERROR" */
}
class ReportError extends FoxholeError {
  /* code: "REPORT_ERROR" */
}
```

## Convention: throw everywhere

The codebase uses a single convention: functions throw typed error classes on failure. There is no `Result`-returning layer. This was decided during Phase 1 -- see ADR-003 Amendment.

- Runner functions throw `RunnerError`.
- Config loading throws `ConfigError`.
- File I/O failures throw the appropriate typed class.
- The orchestrator in `src/runner/index.ts` catches per-page `RunnerError` and isolates it; the overall run continues.

## Result type (exists, no callers)

`src/errors.ts` exports `Result<T>`, `ok()`, `err()` for potential future use. They currently have no callers. Do not introduce new `Result`-returning functions -- the codebase would then mix two conventions. If you need to signal an expected failure, throw a typed error.

## formatErrorChain

```typescript
function formatErrorChain(error: unknown): string;
```

Renders an error and its full `cause` chain as a colon-joined string. Use this in user-facing error messages when you want to surface the root cause without exposing a stack trace.

## Catch block pattern

Always pass the original error as `cause` when wrapping:

```typescript
try {
  // operation
} catch (cause) {
  throw new RunnerError("Failed to run axe-core against target page", cause);
}
```

Always narrow `unknown` in catch blocks. Never use `any`.

## CLI top-level handler

```typescript
async function main(): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Configuration error: ${error.message}`);
      process.exit(2);
    }
    if (error instanceof FoxholeError) {
      console.error(`Error: ${error.message}`);
      process.exit(2);
    }
    console.error("Unexpected error. Please report this as a bug.");
    process.exit(2);
  }
}
```

## Exit codes

- `0` audit passed
- `1` audit completed, score below threshold
- `2` runtime error, config error, or unexpected failure

## Anti-patterns

**failure**: `throw new Error("string")`. Always throw a typed subclass of `FoxholeError`.

**failure**: Catching and swallowing errors silently. Log to stderr or re-throw.

**failure**: Using `any` in catch blocks. Use `unknown` and narrow with `instanceof`.

**failure**: Introducing a new `Result`-returning function. The codebase is throw-everywhere; mixing conventions breaks the contract.

**warning**: Exposing stack traces or internal paths in user-facing error messages. Use `error.message` only.

**warning**: Re-throwing without wrapping. Wrap with context: `throw new RunnerError("...", cause)`.

**info**: Retry logic inside runners. Runners fail fast. Retry belongs at the CLI or MCP call site if needed at all.

## When to load this skill

- Writing any function that calls external services (Playwright, Lighthouse, axe-core, file system)
- Adding or modifying error handling in any `src/` file
- Reviewing how a module handles failures
- Writing CLI command handlers

## When not to load this skill

- Test files that assert on thrown errors (use `expect().toThrow()` patterns from the test-patterns skill)
- Reading error handling logic to understand behavior (no changes needed)

## References

- `src/errors.ts` -- all error classes, `Result<T>`, `ok`, `err`, `formatErrorChain`
- `docs/decisions/ADR-003.md` -- error handling strategy and the Phase 1 amendment (throw-everywhere, Result withdrawn)
- `docs/spec/architecture.md` section 6 -- per-page failure isolation contract
