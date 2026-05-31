import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { ConfigError, FoxholeError, formatErrorChain } from "../../errors.js";
import { loadConfig } from "../../config/load.js";
import type { FoxholeConfig } from "../../config/schema.js";
import { resolveRunOptions } from "../../config/resolve-options.js";
import { buildAuditReport } from "../../audit/index.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import { serveStaticBuild } from "../../server/static.js";
import type { StaticServer } from "../../server/static.js";
import type { RunOptions } from "../options.js";
import type { AuditReport } from "../../types/index.js";

type InputMode = "url" | "urls" | "build";

function validateInputMode(options: RunOptions, config: FoxholeConfig | undefined): InputMode {
  const hasUrl = options.url !== undefined || config?.url !== undefined;
  const hasUrls =
    options.urls !== undefined || (config?.urls !== undefined && config.urls.length > 0);
  const hasBuild = options.build !== undefined;

  if (!hasUrl && !hasUrls && !hasBuild) {
    process.stderr.write("Error: one of --url, --urls, or --build is required\n");
    process.exit(2);
  }

  if (hasUrl && hasUrls) {
    process.stderr.write("Error: --url and --urls are mutually exclusive\n");
    process.exit(2);
  }

  if (hasUrl && hasBuild) {
    process.stderr.write("Error: --url and --build are mutually exclusive\n");
    process.exit(2);
  }

  if (hasBuild && !hasUrls) {
    process.stderr.write("Error: --build requires --urls\n");
    process.exit(2);
  }

  if (hasBuild) return "build";
  if (hasUrl) return "url";
  return "urls";
}

function resolveUrls(
  options: RunOptions,
  serverUrl: string | null,
  config: FoxholeConfig | undefined,
): string[] {
  // CLI flags win; config fields are the fallback.
  const effectiveUrl = options.url ?? config?.url;
  if (effectiveUrl !== undefined) return [effectiveUrl];

  const parts =
    options.urls !== undefined
      ? options.urls.split(",").map((s) => s.trim())
      : (config?.urls ?? []);

  if (serverUrl !== null) {
    return parts.map((u) => (u.startsWith("/") ? `${serverUrl}${u}` : u));
  }
  return parts;
}

function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run a frontend audit against a URL or local build")
    .option("--url <url>", "target URL")
    .option("--urls <urls>", "comma-separated list of URLs")
    .option("--build <path>", "path to static build directory")
    .option("--checks <checks>", "comma-separated checks: perf,a11y,semantic,bundle")
    .option("--output <format>", "output format: json or markdown")
    .option("--out <path>", "file path for output")
    .option("--config <path>", "path to foxhole.config.json")
    .option("--threshold <n>", "fail if score drops below this value", Number.parseFloat)
    .option("--throttling <preset>", "Lighthouse throttling preset: desktop, mobile, or none")
    .option("--concurrency <n>", "number of URLs to audit in parallel", Number.parseInt)
    .option("--quiet", "suppress progress output")
    .option("--exclude-framework", "exclude framework findings from score computation")
    .addHelpText(
      "after",
      `
Examples:
  foxhole run --url https://example.com
  foxhole run --urls https://example.com,https://example.com/about --checks a11y,perf
  foxhole run --build ./dist --urls /index.html,/about.html --threshold 80 --out report.json

Config file (foxhole.config.json) is auto-discovered in the current directory when --config is not set.`,
    )
    .action(async (options: RunOptions) => {
      try {
        await handleRun(options);
      } catch (error) {
        if (error instanceof FoxholeError) {
          process.stderr.write(`Error: ${error.message}\n`);
          process.exit(2);
        }
        process.stderr.write(`Unexpected error: ${formatErrorChain(error)}\n`);
        process.exit(2);
      }
    });
}

// When --config is absent, look for foxhole.config.json in the current working directory.
// Explicit --config paths always load or throw; auto-discovered config is silently skipped if absent.
async function loadConfigForRun(
  configPath: string | undefined,
): Promise<FoxholeConfig | undefined> {
  if (configPath) return loadConfig(configPath);
  const cwdConfig = path.join(process.cwd(), "foxhole.config.json");
  try {
    await fs.access(cwdConfig);
    return loadConfig(cwdConfig);
  } catch {
    return undefined;
  }
}

async function handleRun(options: RunOptions): Promise<void> {
  const config = await loadConfigForRun(options.config);
  const mode = validateInputMode(options, config);

  let resolved;
  try {
    resolved = resolveRunOptions(options, config);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`Error: ${error.message}\n`);
      process.exit(2);
    }
    throw error;
  }

  const { checks, threshold, outputFormat, throttling, concurrency, out, excludeFramework } =
    resolved;
  const quiet = options.quiet ?? false;

  let server: StaticServer | null = null;
  let report: AuditReport;
  try {
    let serverUrl: string | null = null;
    if (mode === "build" && options.build !== undefined) {
      server = await serveStaticBuild(options.build);
      serverUrl = server.url;
    }
    const urls = resolveUrls(options, serverUrl, config);

    report = await buildAuditReport({
      urls,
      checks,
      quiet,
      threshold,
      throttling,
      inputMode: mode,
      concurrency,
      perfRuns: 1,
      sourceMaps: "auto",
      excludeFramework,
    });
  } finally {
    if (server) await server.close();
  }

  const content =
    outputFormat === "json" ? JSON.stringify(report, null, 2) : renderMarkdownReport(report);

  if (out) {
    await fs.writeFile(out, content, "utf8");
  } else {
    process.stdout.write(content);
  }

  if (!report.meta.passed) {
    process.exit(1);
  }
}

export { registerRunCommand, handleRun };
