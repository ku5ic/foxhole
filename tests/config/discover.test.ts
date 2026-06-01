import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  default: { access: vi.fn() },
}));

vi.mock("../../src/config/load.js", () => ({
  loadConfig: vi.fn(),
}));

import fs from "node:fs/promises";
import { loadConfig } from "../../src/config/load.js";
import { ConfigError } from "../../src/errors.js";
import { discoverConfig } from "../../src/config/discover.js";
import type { FoxholeConfig } from "../../src/config/schema.js";

const MINIMAL_CONFIG: FoxholeConfig = {
  checks: ["a11y", "perf", "semantic", "bundle"],
  output: "markdown",
  exclude_framework: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("discoverConfig -- explicit path", () => {
  it("returns config and path when loadConfig succeeds", async () => {
    vi.mocked(loadConfig).mockResolvedValue(MINIMAL_CONFIG);
    const result = await discoverConfig("/project/foxhole.config.json");
    expect(loadConfig).toHaveBeenCalledWith("/project/foxhole.config.json");
    expect(result).toEqual({ config: MINIMAL_CONFIG, path: "/project/foxhole.config.json" });
  });

  it("propagates error when loadConfig throws for explicit path", async () => {
    vi.mocked(loadConfig).mockRejectedValue(new ConfigError("not found"));
    await expect(discoverConfig("/missing/config.json")).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("discoverConfig -- cwd auto-discovery", () => {
  it("returns config and cwd path when foxhole.config.json exists", async () => {
    vi.mocked(fs.access).mockResolvedValue(null as never);
    vi.mocked(loadConfig).mockResolvedValue(MINIMAL_CONFIG);
    const result = await discoverConfig();
    expect(result?.config).toEqual(MINIMAL_CONFIG);
    expect(result?.path).toContain("foxhole.config.json");
  });

  it("returns undefined when foxhole.config.json does not exist in cwd", async () => {
    vi.mocked(fs.access).mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
    );
    const result = await discoverConfig();
    expect(result).toBeUndefined();
    expect(loadConfig).not.toHaveBeenCalled();
  });

  it("propagates error when config file exists but loadConfig throws", async () => {
    vi.mocked(fs.access).mockResolvedValue(null as never);
    vi.mocked(loadConfig).mockRejectedValue(new ConfigError("invalid JSON"));
    await expect(discoverConfig()).rejects.toBeInstanceOf(ConfigError);
  });
});
