import fs from "node:fs/promises";

import type { Command } from "commander";

import { FoxholeError } from "../../errors.js";
import { loadConfig } from "../../config/load.js";
import { DEFAULT_CHECKS } from "../../config/defaults.js";
import { buildAuditReport } from "../../audit/index.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import type { RunOptions } from "../options.js";
import type { CheckCategory } from "../../types/index.js";

function parseChecks(input: string): CheckCategory[] {
  return input.split(",").map((s) => s.trim()) as CheckCategory[];
}

function resolveUrls(options: RunOptions): string[] {
  if (options.url) return [options.url];
  if (options.urls) return options.urls.split(",").map((s) => s.trim());
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
  const hasInput = options.url ?? options.urls ?? options.build;
  if (!hasInput) {
    process.stderr.write("Error: one of --url, --urls, or --build is required\n");
    process.exit(2);
  }

  const config = options.config ? await loadConfig(options.config) : undefined;

  const checks: CheckCategory[] = options.checks
    ? parseChecks(options.checks)
    : config?.checks ?? DEFAULT_CHECKS;

  const urls = resolveUrls(options);
  const threshold = options.threshold ?? config?.threshold;
  const outputFormat = options.output ?? config?.output ?? "markdown";
  const quiet = options.quiet ?? false;

  const report = await buildAuditReport({
    urls,
    checks,
    quiet,
    threshold,
  });

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

export { registerRunCommand };
