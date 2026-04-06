import fs from "node:fs/promises";

import type { Command } from "commander";

import { ConfigError, FoxholeError } from "../../errors.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import type { AuditReport } from "../../types/index.js";

async function readAuditFile(filePath: string): Promise<AuditReport> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (cause) {
    throw new ConfigError(`Audit file not found: ${filePath}`, cause);
  }

  try {
    return JSON.parse(raw) as AuditReport;
  } catch (cause) {
    throw new ConfigError(`Failed to parse audit file: ${filePath}`, cause);
  }
}

function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Generate a report from a JSON audit file")
    .argument("<input>", "path to a JSON audit file")
    .option("--output <format>", "output format: json or markdown", "markdown")
    .action(async (inputPath: string, options: { output: string }) => {
      try {
        const report = await readAuditFile(inputPath);
        const content =
          options.output === "json"
            ? JSON.stringify(report, null, 2)
            : renderMarkdownReport(report);
        process.stdout.write(content);
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

export { registerReportCommand };
