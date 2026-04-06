import fs from "node:fs/promises";

import { ConfigError } from "../errors.js";
import { foxholeConfigSchema } from "./schema.js";
import type { FoxholeConfig } from "./schema.js";

async function loadConfig(configPath: string): Promise<FoxholeConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (cause) {
    throw new ConfigError(`Configuration file not found: ${configPath}`, cause);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ConfigError(`Failed to parse config file: ${configPath}`, cause);
  }

  const result = foxholeConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid configuration: ${issues}`);
  }

  return result.data;
}

export { loadConfig };
