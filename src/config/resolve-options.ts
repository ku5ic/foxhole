import { DEFAULT_CHECKS, DEFAULT_OUTPUT, DEFAULT_THROTTLING } from "./defaults.js";
import { validateChecks, validateThreshold } from "./validate.js";
import { ConfigError } from "../errors.js";
import type { FoxholeConfig } from "./schema.js";
import type { CheckCategory } from "../types/index.js";
import type { ThrottlingPreset } from "../runner/index.js";

interface ResolvedRunOptions {
  checks: CheckCategory[];
  threshold: number | undefined;
  outputFormat: "json" | "markdown";
  throttling: ThrottlingPreset;
  out: string | undefined;
}

const VALID_THROTTLING: ReadonlySet<ThrottlingPreset> = new Set(["desktop", "mobile", "none"]);

function resolveRunOptions(
  rawOptions: {
    checks?: string;
    threshold?: number;
    output?: string;
    throttling?: string;
    out?: string;
  },
  config?: FoxholeConfig,
): ResolvedRunOptions {
  // checks: flag wins; if absent fall back to config, then default
  const checks =
    rawOptions.checks !== undefined
      ? validateChecks(rawOptions.checks.split(",").map((s) => s.trim()))
      : (config?.checks ?? DEFAULT_CHECKS);

  // threshold: flag wins; if absent fall back to config
  const rawThreshold = rawOptions.threshold ?? config?.threshold;
  const threshold = rawThreshold !== undefined ? validateThreshold(rawThreshold) : undefined;

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

  // out: flag wins; if absent fall back to config
  const out = rawOptions.out ?? config?.out;

  return { checks, threshold, outputFormat, throttling, out };
}

export { resolveRunOptions };
export type { ResolvedRunOptions };
