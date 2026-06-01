import {
  DEFAULT_CHECKS,
  DEFAULT_CONCURRENCY,
  DEFAULT_OUTPUT,
  DEFAULT_THROTTLING,
} from "./defaults.js";
import { validateChecks, validateConcurrency, validateThreshold } from "./validate.js";
import { ConfigError } from "../errors.js";
import type { FoxholeConfig } from "./schema.js";
import type { CheckCategory } from "../types/index.js";
import type { ThrottlingPreset } from "../types/index.js";

interface ResolvedRunOptions {
  checks: CheckCategory[];
  threshold: number | undefined;
  outputFormat: "json" | "markdown";
  throttling: ThrottlingPreset;
  concurrency: number;
  out: string | undefined;
  excludeFramework: boolean;
}

const VALID_THROTTLING: ReadonlySet<ThrottlingPreset> = new Set(["desktop", "mobile", "none"]);

function resolveRunOptions(
  rawOptions: {
    checks?: string;
    threshold?: number;
    output?: string;
    throttling?: string;
    concurrency?: number;
    out?: string;
    excludeFramework?: boolean;
  },
  config?: FoxholeConfig,
): ResolvedRunOptions {
  // checks: flag wins; if absent fall back to config, then default
  const checks =
    rawOptions.checks === undefined
      ? (config?.checks ?? DEFAULT_CHECKS)
      : validateChecks(rawOptions.checks.split(",").map((s) => s.trim()));

  // threshold: flag wins; if absent fall back to config
  const rawThreshold = rawOptions.threshold ?? config?.threshold;
  const threshold = rawThreshold === undefined ? undefined : validateThreshold(rawThreshold);

  // output: flag wins; if absent fall back to config, then default
  const rawOutput = rawOptions.output ?? config?.output ?? DEFAULT_OUTPUT;
  if (rawOutput !== "json" && rawOutput !== "markdown") {
    throw new ConfigError(`--output must be "json" or "markdown" (got "${rawOutput}")`);
  }
  const outputFormat = rawOutput;

  // throttling: flag wins; if absent fall back to config, then default
  const rawThrottling = rawOptions.throttling ?? config?.throttling ?? DEFAULT_THROTTLING;
  if (!VALID_THROTTLING.has(rawThrottling as ThrottlingPreset)) {
    throw new ConfigError(
      `--throttling must be one of: desktop, mobile, none (got "${rawThrottling}")`,
    );
  }
  const throttling = rawThrottling as ThrottlingPreset;

  // concurrency: flag wins; if absent fall back to config, then default
  const rawConcurrency = rawOptions.concurrency ?? config?.concurrency ?? DEFAULT_CONCURRENCY;
  const concurrency = validateConcurrency(rawConcurrency);

  // out: flag wins; if absent fall back to config
  const out = rawOptions.out ?? config?.out;

  // excludeFramework: flag wins; if absent fall back to config, then default false
  const excludeFramework = rawOptions.excludeFramework ?? config?.exclude_framework ?? false;

  return { checks, threshold, outputFormat, throttling, concurrency, out, excludeFramework };
}

export { resolveRunOptions };
export type { ResolvedRunOptions };
