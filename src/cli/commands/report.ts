import type { Command } from "commander";

import { FoxholeError, formatErrorChain } from "../../errors.js";
import { readAuditReport } from "../../audit/read-report.js";
import { renderMarkdownReport } from "../../report/markdown.js";

function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Generate a report from a JSON audit file")
    .argument("<input>", "path to a JSON audit file")
    .option("--output <format>", "output format: json or markdown", "markdown")
    .action(async (inputPath: string, options: { output: string }) => {
      try {
        const report = await readAuditReport(inputPath);
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
        process.stderr.write(`Unexpected error: ${formatErrorChain(error)}\n`);
        process.exit(2);
      }
    });
}

export { registerReportCommand };
