import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { Command } from "commander";

import { registerRunCommand } from "./commands/run.js";
import { registerCompareCommand } from "./commands/compare.js";
import { registerReportCommand } from "./commands/report.js";
import { registerInitCommand } from "./commands/init.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version: string };

const program = new Command();

program
  .name("foxhole")
  .version(packageJson.version)
  .description(
    "Frontend audit CLI. Audits URLs and local builds for accessibility, performance, semantics, and bundle issues.",
  );

registerRunCommand(program);
registerCompareCommand(program);
registerReportCommand(program);
registerInitCommand(program);

program.parse(process.argv);
