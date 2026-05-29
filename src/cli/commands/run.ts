import fs from "node:fs/promises";

import type { Command } from "commander";

import { FoxholeError } from "../../errors.js";
import { loadConfig } from "../../config/load.js";
import { DEFAULT_CHECKS, DEFAULT_THROTTLING } from "../../config/defaults.js";
import type { ThrottlingPreset } from "../../runner/index.js";
import { buildAuditReport } from "../../audit/index.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import { serveStaticBuild } from "../../server/static.js";
import type { StaticServer } from "../../server/static.js";
import type { RunOptions } from "../options.js";
import type { AuditReport, CheckCategory } from "../../types/index.js";

type InputMode = "url" | "urls" | "build";

function parseChecks(input: string): CheckCategory[] {
  return input.split(",").map((s) => s.trim()) as CheckCategory[];
}

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
    .option("--output <format>", "output format: json or markdown", "markdown")
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

  const checks: CheckCategory[] = options.checks
    ? parseChecks(options.checks)
    : (config?.checks ?? DEFAULT_CHECKS);

  const threshold = options.threshold ?? config?.threshold;
  const outputFormat = options.output ?? config?.output ?? "markdown";
  const quiet = options.quiet ?? false;

  const rawThrottling = options.throttling ?? config?.throttling ?? DEFAULT_THROTTLING;
  const VALID_THROTTLING = ["desktop", "mobile", "none"] as const;
  if (!VALID_THROTTLING.includes(rawThrottling as ThrottlingPreset)) {
    process.stderr.write(
      `Error: --throttling must be one of: desktop, mobile, none (got "${rawThrottling}")\n`,
    );
    process.exit(2);
  }
  const throttling = rawThrottling as ThrottlingPreset;

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
    });
  } finally {
    if (server) await server.close();
  }

  const content =
    outputFormat === "json" ? JSON.stringify(report, null, 2) : renderMarkdownReport(report);

  if (options.out) {
    await fs.writeFile(options.out, content, "utf8");
  } else {
    process.stdout.write(content);
  }

  if (!report.meta.passed) {
    process.exit(1);
  }
}

export { registerRunCommand, handleRun };
