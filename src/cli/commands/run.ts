import fs from "node:fs/promises";

import type { Command } from "commander";

import { ConfigError, FoxholeError } from "../../errors.js";
import { loadConfig } from "../../config/load.js";
import { resolveRunOptions } from "../../config/resolve-options.js";
import { buildAuditReport } from "../../audit/index.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import { serveStaticBuild } from "../../server/static.js";
import type { StaticServer } from "../../server/static.js";
import type { RunOptions } from "../options.js";
import type { AuditReport } from "../../types/index.js";

type InputMode = "url" | "urls" | "build";

function validateInputMode(options: RunOptions): InputMode {
  const hasUrl = options.url !== undefined;
  const hasUrls = options.urls !== undefined;
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

function resolveUrls(options: RunOptions, serverUrl: string | null): string[] {
  if (options.url !== undefined) return [options.url];
  if (options.urls !== undefined) {
    const parts = options.urls.split(",").map((s) => s.trim());
    if (serverUrl !== null) {
      return parts.map((u) => (u.startsWith("/") ? `${serverUrl}${u}` : u));
    }
    return parts;
  }
  return [];
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
    .option("--quiet", "suppress progress output")
    .action(async (options: RunOptions) => {
      try {
        await handleRun(options);
      } catch (error) {
        if (error instanceof FoxholeError) {
          process.stderr.write(`Error: ${error.message}\n`);
          process.exit(2);
        }
        process.stderr.write("Unexpected error. Please report this as a bug.\n");
        process.exit(2);
      }
    });
}

async function handleRun(options: RunOptions): Promise<void> {
  const mode = validateInputMode(options);

  const config = options.config ? await loadConfig(options.config) : undefined;

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

  const { checks, threshold, outputFormat, throttling, out } = resolved;
  const quiet = options.quiet ?? false;

  let server: StaticServer | null = null;
  let report: AuditReport;
  try {
    let serverUrl: string | null = null;
    if (mode === "build" && options.build !== undefined) {
      server = await serveStaticBuild(options.build);
      serverUrl = server.url;
    }
    const urls = resolveUrls(options, serverUrl);

    report = await buildAuditReport({
      urls,
      checks,
      quiet,
      threshold,
      throttling,
      inputMode: mode,
      concurrency: 1, // becomes a real option in a later phase
      perfRuns: 1, // becomes a real option in a later phase
      sourceMaps: "auto", // becomes a real option in a later phase
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
