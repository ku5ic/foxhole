# Skill: Error handling

Foxhole is a CLI tool and MCP server. Error handling must be explicit, typed, and consistent across the entire codebase. Unhandled promise rejections and uncaught exceptions are not acceptable in production.

## Error classes

Define typed error classes for each failure domain. All errors extend a base `FoxholeError`.

```typescript
class FoxholeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FoxholeError";
  }
}

class ConfigError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFIG_ERROR", cause);
    this.name = "ConfigError";
  }
}

class RunnerError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "RUNNER_ERROR", cause);
    this.name = "RunnerError";
  }
}

class NetworkError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "NETWORK_ERROR", cause);
    this.name = "NetworkError";
  }
}

class ReportError extends FoxholeError {
  constructor(message: string, cause?: unknown) {
    super(message, "REPORT_ERROR", cause);
    this.name = "ReportError";
  }
}
```

## Result type

For operations that can fail in expected ways, use a Result type instead of throwing.

```typescript
type Result<T, E extends FoxholeError = FoxholeError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<E extends FoxholeError>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

Use Result for:

- Config loading and validation
- File reads and writes
- Network requests

Use throw for:

- Programming errors that should never happen in correct code
- Unrecoverable states where the process must exit

## Rules

- Never `throw new Error("string")`. Always throw a typed error class.
- Never catch and swallow errors silently. Log or re-throw.
- Never use `any` in catch blocks. Use `unknown` and narrow.
- Always pass the original error as `cause` when wrapping.
- Async functions that can fail return `Promise<Result<T>>`, not `Promise<T>`.
- Runner failures are isolated. One page failing does not abort the full audit.
- CLI commands catch at the top level, map errors to exit codes, and print clean messages.

## Catch block pattern

```typescript
try {
  // operation
} catch (cause) {
  throw new RunnerError("Failed to run axe-core against target page", cause);
}
```

## CLI top-level error handler

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

## What never belongs in error handling

- User-facing error messages that expose internal stack traces.
- Retry logic inside runners. Fail fast and let the CLI surface the error.
- Silent fallbacks that hide failures from the user.
