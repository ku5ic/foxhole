import fs from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "./load.js";
import type { FoxholeConfig } from "./schema.js";

interface DiscoveredConfig {
  config: FoxholeConfig;
  path: string;
}

async function discoverConfig(configPath?: string): Promise<DiscoveredConfig | undefined> {
  if (configPath !== undefined) {
    const config = await loadConfig(configPath);
    return { config, path: configPath };
  }

  const cwdConfigPath = path.join(process.cwd(), "foxhole.config.json");
  try {
    await fs.access(cwdConfigPath);
  } catch {
    return undefined;
  }
  const config = await loadConfig(cwdConfigPath);
  return { config, path: cwdConfigPath };
}

export { discoverConfig };
export type { DiscoveredConfig };
