import type { Command } from "commander";

import { ConfigError, FoxholeError, formatErrorChain } from "../../errors.js";
import { readAuditReport } from "../../audit/read-report.js";
import { diffReports } from "../../audit/diff.js";

interface CompareOptions {
  threshold?: number;
}

async function handleCompare(
  beforePath: string,
  afterPath: string,
  options: CompareOptions,
): Promise<number> {
  if (options.threshold !== undefined && Number.isNaN(options.threshold)) {
    throw new ConfigError("--threshold must be a number");
  }

  const before = await readAuditReport(beforePath);
  const after = await readAuditReport(afterPath);
  const diff = diffReports(before, after);

  process.stdout.write(JSON.stringify(diff, null, 2));

  if (options.threshold !== undefined && diff.score_delta < options.threshold) {
    return 1;
  }
  return 0;
}

function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("Compare two audit reports and show regressions and improvements")
    .argument("<before>", "path to the baseline audit JSON file")
    .argument("<after>", "path to the new audit JSON file")
    .option(
      "--threshold <n>",
      "exit with code 1 if score_delta is below this value",
      Number.parseFloat,
    )
    .action(async (beforePath: string, afterPath: string, options: CompareOptions) => {
      try {
        const code = await handleCompare(beforePath, afterPath, options);
        process.exit(code);
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

export { registerCompareCommand, handleCompare };
