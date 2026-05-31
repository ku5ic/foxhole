import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import type { Command } from "commander";

import { formatErrorChain } from "../../errors.js";
import { foxholeConfigSchema } from "../../config/schema.js";

// Base defaults come from the schema; threshold is set to a common starting value.
const INIT_DEFAULTS = {
  ...foxholeConfigSchema.parse({}),
  threshold: 80,
};

function promptOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(`${filePath} already exists. Overwrite? (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a default foxhole.config.json in the current directory")
    .action(async () => {
      try {
        const filePath = path.resolve("foxhole.config.json");

        let exists = false;
        try {
          await fs.access(filePath);
          exists = true;
        } catch {
          // file does not exist, safe to write
        }

        if (exists) {
          const confirmed = await promptOverwrite(filePath);
          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }
        }

        await fs.writeFile(filePath, JSON.stringify(INIT_DEFAULTS, null, 2) + "\n", "utf8");
        process.stderr.write(`Created ${filePath}\n`);
      } catch (error) {
        process.stderr.write(`Unexpected error: ${formatErrorChain(error)}\n`);
        process.exit(2);
      }
    });
}

export { registerInitCommand };
