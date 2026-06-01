import { discoverConfig } from "./discover.js";
import { validateChecks, validateThreshold } from "./validate.js";
import { DEFAULT_CHECKS, DEFAULT_CONCURRENCY, DEFAULT_THROTTLING } from "./defaults.js";
import { ConfigError } from "../errors.js";
import type { CheckCategory, InputMode } from "../types/index.js";
import type { ThrottlingPreset } from "../types/index.js";

interface McpAuditInput {
  url?: string | undefined;
  urls?: string | undefined;
  checks?: string | undefined;
  threshold?: number | undefined;
  config?: string | undefined;
}

interface ResolvedMcpAudit {
  urls: string[];
  inputMode: InputMode;
  checks: CheckCategory[];
  threshold: number | undefined;
  throttling: ThrottlingPreset;
  concurrency: number;
  excludeFramework: boolean;
}

async function resolveMcpAuditOptions(
  input: McpAuditInput,
  forcedChecks?: CheckCategory[],
): Promise<ResolvedMcpAudit> {
  const discovered = await discoverConfig(input.config);
  const config = discovered?.config;

  if (input.url !== undefined && input.urls !== undefined) {
    throw new ConfigError("url and urls are mutually exclusive");
  }

  let urls: string[];
  let inputMode: InputMode;

  if (input.url !== undefined) {
    urls = [input.url];
    inputMode = "url";
  } else if (input.urls !== undefined) {
    urls = input.urls.split(",").map((s) => s.trim());
    inputMode = "urls";
  } else if (config?.url !== undefined) {
    urls = [config.url];
    inputMode = "url";
  } else if (config?.urls !== undefined && config.urls.length > 0) {
    urls = config.urls;
    inputMode = "urls";
  } else {
    if (discovered === undefined) {
      throw new ConfigError(
        "No URL provided. Pass url or urls, or set one in foxhole.config.json.",
      );
    }
    throw new ConfigError(
      `${discovered.path} does not specify url or urls, and no url or urls were passed`,
    );
  }

  let checks: CheckCategory[];
  if (forcedChecks !== undefined) {
    checks = forcedChecks;
  } else if (input.checks === undefined) {
    checks = config?.checks ?? DEFAULT_CHECKS;
  } else {
    checks = validateChecks(input.checks.split(",").map((s) => s.trim()));
  }

  const rawThreshold = input.threshold ?? config?.threshold;
  let threshold: number | undefined;
  if (rawThreshold !== undefined) {
    threshold = validateThreshold(rawThreshold);
  }

  const throttling = config?.throttling ?? DEFAULT_THROTTLING;
  const concurrency = config?.concurrency ?? DEFAULT_CONCURRENCY;
  const excludeFramework = config?.exclude_framework ?? false;

  return { urls, inputMode, checks, threshold, throttling, concurrency, excludeFramework };
}

export { resolveMcpAuditOptions };
export type { McpAuditInput, ResolvedMcpAudit };
