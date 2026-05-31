---
name: security
description: Security patterns specific to foxhole's attack surface. Use whenever working in code that handles user-supplied URLs, file paths, config values, or axe-core selectors, OR the user asks about input validation, Playwright sandboxing, or output sanitization in this project.
metadata:
  type: project
---

# Skill: Security patterns

Foxhole accepts user-supplied URLs, file paths, and config values. Every external input is a potential attack surface. These patterns apply to every module that touches user input.

## URL validation

Always validate URLs before passing them to Playwright. Use the built-in `URL` constructor -- do not write custom regex.

```typescript
function validateUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new ConfigError(`Invalid URL: ${input}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError(`URL must use http or https protocol: ${input}`);
  }

  return parsed.toString();
}
```

Never allow: `file://`, `javascript:`, `data:`, or any non-HTTP/HTTPS protocol.

## File path validation

All user-supplied file paths must be resolved and validated before use.

```typescript
import path from "node:path";
import fs from "node:fs/promises";

async function validateOutputPath(input: string): Promise<string> {
  const resolved = path.resolve(input);
  const dir = path.dirname(resolved);

  try {
    await fs.access(dir);
  } catch {
    throw new ConfigError(`Output directory does not exist: ${dir}`);
  }

  return resolved;
}
```

Never use user-supplied paths in shell commands. Never assume a directory exists without checking.

## Selector sanitization

Selectors from axe-core appear in report output. Always call `sanitizeSelector` from `src/runner/sanitize.ts` before storing or rendering any axe-core selector.

`sanitizeSelector` removes `<`, `>`, and backtick characters and truncates to 200 characters. These are the characters that break markdown rendering.

## Config validation

All config values pass through the Zod schema in `src/config/schema.ts` before use. Never access raw config values directly.

## JSON output rules

- Never include raw error messages or stack traces in JSON output.
- Never include environment variables or system paths in output.
- `meta.platform` and `meta.node_version` are intentional and acceptable for debugging.

## Playwright sandboxing

Set a reasonable navigation timeout. Always pass `--disable-dev-shm-usage` for CI compatibility.

```typescript
const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setDefaultNavigationTimeout(30_000);
```

Pass `--no-sandbox` only in CI environments where the default Chromium sandbox cannot run. Never pass it in development or when auditing untrusted content. Do not treat it as a default.

Do not pass user-supplied strings as JavaScript to `page.evaluate()`.

## Dependency hygiene

- Run `npm audit` before every release.
- Pin major versions of Playwright, axe-core, and Lighthouse in `package.json`.
- Do not install dependencies that are unused.

## Anti-patterns

**failure**: Passing a user-supplied URL to Playwright without calling `validateUrl` first. An unvalidated `javascript:` URL would execute arbitrary code in the browser context.

**failure**: Using user-supplied strings in `page.evaluate()`. This is arbitrary code execution.

**failure**: Exposing stack traces in user-facing error messages. Use `error.message` only; let `formatErrorChain` render the cause chain if needed.

**warning**: Using `--no-sandbox` as a default browser launch argument. It disables the Chromium sandbox everywhere, not just in CI.

**warning**: Storing raw axe-core selectors without running `sanitizeSelector`. Backticks and angle brackets in selectors corrupt markdown output.

**info**: Not validating the output file path before writing. A path traversal attack would write the report to an unexpected location.

## When to load this skill

- Any code that accepts or processes user-supplied URLs, file paths, or config values
- Any code that produces output containing axe-core selectors
- Reviewing input handling in `src/config/`, `src/cli/`, or `src/runner/`

## When not to load this skill

- Working in `src/audit/`, `src/report/` internals that only consume already-validated data
- Reviewing scoring or prioritization logic

## References

- `src/runner/sanitize.ts` -- `sanitizeSelector` implementation
- `src/config/schema.ts` -- Zod config schema
- `src/config/resolve-options.ts` -- URL and path resolution
- `docs/spec/v1.md` section 5.3 -- input mode rules and validation requirements
