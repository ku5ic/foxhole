import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import type { Command } from "commander";

const DEFAULT_CONFIG = {
  checks: ["perf", "a11y", "semantic", "bundle"],
  output: "markdown",
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

      await fs.writeFile(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
      process.stderr.write(`Created ${filePath}\n`);
    });
}

export { registerInitCommand };
