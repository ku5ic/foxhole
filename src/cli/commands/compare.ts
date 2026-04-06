import fs from "node:fs/promises";

import type { Command } from "commander";

import { ConfigError, FoxholeError } from "../../errors.js";
import { diffReports } from "../../audit/diff.js";
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

function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("Compare two audit reports and show regressions and improvements")
    .argument("<before>", "path to the baseline audit JSON file")
    .argument("<after>", "path to the new audit JSON file")
    .action(async (beforePath: string, afterPath: string) => {
      try {
        const before = await readAuditFile(beforePath);
        const after = await readAuditFile(afterPath);
        const diff = diffReports(before, after);
        process.stdout.write(JSON.stringify(diff, null, 2));
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

export { registerCompareCommand };
