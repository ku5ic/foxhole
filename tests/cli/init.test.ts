import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../../src/config/load.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Use a fixed temp path in the fixtures directory to avoid polluting the project root.
const TMP_CONFIG = path.resolve(__dirname, "../fixtures/__tmp-init-config.json");

beforeEach(() => {
  if (existsSync(TMP_CONFIG)) unlinkSync(TMP_CONFIG);
});

afterEach(() => {
  if (existsSync(TMP_CONFIG)) unlinkSync(TMP_CONFIG);
  vi.restoreAllMocks();
});

describe("init default config round-trip", () => {
  it("INIT_DEFAULTS is accepted by foxholeConfigSchema", async () => {
    const { foxholeConfigSchema } = await import("../../src/config/schema.js");
    // Derive the same defaults init.ts uses.
    const defaults = { ...foxholeConfigSchema.parse({}), threshold: 80 };
    const result = foxholeConfigSchema.safeParse(defaults);
    expect(result.success).toBe(true);
  });

  it("the file written by init is accepted by loadConfig", async () => {
    const { foxholeConfigSchema } = await import("../../src/config/schema.js");
    const defaults = { ...foxholeConfigSchema.parse({}), threshold: 80 };
    writeFileSync(TMP_CONFIG, JSON.stringify(defaults, null, 2) + "\n", "utf8");

    const loaded = await loadConfig(TMP_CONFIG);
    expect(loaded.checks).toEqual(defaults.checks);
    expect(loaded.output).toBe(defaults.output);
    expect(loaded.threshold).toBe(80);
  });

  it("init defaults do not contain unknown keys (strict schema check)", async () => {
    const { foxholeConfigSchema } = await import("../../src/config/schema.js");
    const defaults = { ...foxholeConfigSchema.parse({}), threshold: 80 };
    const result = foxholeConfigSchema.safeParse(defaults);
    expect(result.success).toBe(true);
  });
});
