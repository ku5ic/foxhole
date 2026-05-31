import { ConfigError } from "../errors.js";
import { checkCategorySchema } from "../types/schema.js";
import type { CheckCategory } from "../types/index.js";

// Blocks non-http(s) protocols (file:, javascript:, data:) from being used as audit targets.
// Internal-address SSRF (169.254.x, 10.x, localhost) is not blocked here; that is deferred to
// the hosted layer where the risk is meaningful.
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

function validateConcurrency(raw: number): number {
  if (!Number.isInteger(raw) || raw < 1) {
    throw new ConfigError(`--concurrency must be a positive integer (got ${String(raw)})`);
  }
  return raw;
}

export { validateUrl, validateChecks, validateThreshold, validateConcurrency };
