# Skill: Security patterns

Foxhole accepts user-supplied URLs, file paths, and config values. Every external input is a potential attack surface. These patterns apply to every module that touches user input.

## URL validation

Always validate URLs before passing them to Playwright. Use the built-in URL constructor, do not write custom regex.

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

Never allow:

- `file://` URLs. Use `--build` mode for local files.
- `javascript:` URLs.
- `data:` URLs.
- Non-HTTP protocols.

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

Never:

- Use user-supplied paths in shell commands.
- Allow path traversal: validate that resolved paths stay within expected boundaries where relevant.
- Trust that a directory exists without checking.

## Selector sanitization

Selectors from axe-core appear in report output. Sanitize before rendering.

```typescript
function sanitizeSelector(selector: string): string {
  return selector.replace(/[<>]/g, "").slice(0, 200);
}
```

## Config validation

All config values are validated through the Zod schema in src/config/schema.ts before use. Never access raw config values directly.

```typescript
const configSchema = z.object({
  url: z.string().url().optional(),
  urls: z.array(z.string()).optional(),
  build: z.string().optional(),
  checks: z.array(z.enum(["perf", "a11y", "semantic", "bundle"])).optional(),
  output: z.enum(["json", "markdown", "pdf"]).optional(),
  out: z.string().optional(),
  threshold: z.number().min(0).max(100).optional(),
});
```

## JSON output

- Never include raw error messages or stack traces in JSON output.
- Never include environment variables or system paths in output.
- The `meta` field includes platform and Node version for debugging. This is intentional and acceptable.

## Playwright sandboxing

- Always launch Chromium with `--no-sandbox` disabled in CI environments only.
- Do not pass user-supplied strings as JavaScript to `page.evaluate()`.
- Set a reasonable navigation timeout. Default to 30 seconds.

```typescript
const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setDefaultNavigationTimeout(30_000);
```

## Dependency hygiene

- Run `npm audit` before every release.
- Pin major versions of Playwright, axe-core, and Lighthouse in package.json.
- Do not install dependencies that are not used.

## What never belongs in output

- Stack traces in user-facing error messages.
- Internal file paths.
- Environment variable values.
- API keys or tokens of any kind.
- Raw axe-core or Lighthouse output that has not been normalized.
