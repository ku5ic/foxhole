import type { Command } from "commander";

import { FoxholeError, formatErrorChain } from "../../errors.js";
import { readAuditReport } from "../../audit/read-report.js";
import { diffReports } from "../../audit/diff.js";

function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("Compare two audit reports and show regressions and improvements")
    .argument("<before>", "path to the baseline audit JSON file")
    .argument("<after>", "path to the new audit JSON file")
    .action(async (beforePath: string, afterPath: string) => {
      try {
        const before = await readAuditReport(beforePath);
        const after = await readAuditReport(afterPath);
        const diff = diffReports(before, after);
        process.stdout.write(JSON.stringify(diff, null, 2));
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

export { registerCompareCommand };
