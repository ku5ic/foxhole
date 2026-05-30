import { ConfigError } from "../errors.js";
import { checkCategorySchema } from "../types/schema.js";
import type { CheckCategory } from "../types/index.js";

// Only http and https are safe for remote auditing. file:, javascript:, and data:
// would allow SSRF or script injection through the audit target URL.
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);

function validateUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ConfigError(`Invalid URL: "${raw}"`);
  }
  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new ConfigError(
      `URL protocol "${parsed.protocol}" is not allowed; only http and https are supported`,
    );
  }
  return raw;
}

function validateChecks(raw: string[]): CheckCategory[] {
  const result: CheckCategory[] = [];
  for (const item of raw) {
    const parsed = checkCategorySchema.safeParse(item);
    if (!parsed.success) {
      throw new ConfigError(
        `Invalid check category "${item}"; valid values are: perf, a11y, semantic, bundle`,
      );
    }
    result.push(parsed.data);
  }
  return result;
}

function validateThreshold(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
    throw new ConfigError(`--threshold must be a number between 0 and 100 (got ${String(raw)})`);
  }
  return raw;
}

export { validateUrl, validateChecks, validateThreshold };
