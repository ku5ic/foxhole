import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/config/discover.js", () => ({
  discoverConfig: vi.fn(),
}));

import { discoverConfig } from "../../src/config/discover.js";
import { resolveMcpAuditOptions } from "../../src/config/resolve-mcp-options.js";
import { ConfigError } from "../../src/errors.js";
import type { FoxholeConfig } from "../../src/config/schema.js";
import type { DiscoveredConfig } from "../../src/config/discover.js";

const BASE_CONFIG: FoxholeConfig = {
  checks: ["perf", "a11y", "semantic", "bundle"],
  output: "markdown",
  exclude_framework: false,
};

function makeDiscovered(overrides: Partial<FoxholeConfig> = {}): DiscoveredConfig {
  return {
    config: { ...BASE_CONFIG, ...overrides },
    path: "/project/foxhole.config.json",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(discoverConfig).mockResolvedValue(undefined as never);
});

describe("resolveMcpAuditOptions -- URL resolution", () => {
  it("uses url from input", async () => {
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.urls).toEqual(["https://example.com"]);
    expect(result.inputMode).toBe("url");
  });

  it("uses urls from input as comma-separated list", async () => {
    const result = await resolveMcpAuditOptions({ urls: "https://a.com, https://b.com" });
    expect(result.urls).toEqual(["https://a.com", "https://b.com"]);
    expect(result.inputMode).toBe("urls");
  });

  it("falls back to url from config when input has no url", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ url: "https://config.com/" }));
    const result = await resolveMcpAuditOptions({});
    expect(result.urls).toEqual(["https://config.com/"]);
    expect(result.inputMode).toBe("url");
  });

  it("falls back to urls array from config when input has no url or urls", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(
      makeDiscovered({ urls: ["https://a.com/", "https://b.com/"] }),
    );
    const result = await resolveMcpAuditOptions({});
    expect(result.urls).toEqual(["https://a.com/", "https://b.com/"]);
    expect(result.inputMode).toBe("urls");
  });

  it("input url wins over config url", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ url: "https://config.com/" }));
    const result = await resolveMcpAuditOptions({ url: "https://input.com/" });
    expect(result.urls).toEqual(["https://input.com/"]);
  });

  it("throws ConfigError when both url and urls are in input", async () => {
    await expect(
      resolveMcpAuditOptions({ url: "https://a.com", urls: "https://b.com" }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws with no-config message when no url source exists and no config was found", async () => {
    await expect(resolveMcpAuditOptions({})).rejects.toThrow(
      "No URL provided. Pass url or urls, or set one in foxhole.config.json.",
    );
  });

  it("throws with config-path message when config found but has no url or urls", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered());
    await expect(resolveMcpAuditOptions({})).rejects.toThrow(
      "/project/foxhole.config.json does not specify url or urls, and no url or urls were passed",
    );
  });
});

describe("resolveMcpAuditOptions -- checks resolution", () => {
  it("uses forcedChecks when provided, ignoring input checks", async () => {
    const result = await resolveMcpAuditOptions(
      { url: "https://example.com", checks: "perf,bundle" },
      ["a11y"],
    );
    expect(result.checks).toEqual(["a11y"]);
  });

  it("uses input checks when no forcedChecks", async () => {
    const result = await resolveMcpAuditOptions({
      url: "https://example.com",
      checks: "perf,a11y",
    });
    expect(result.checks).toEqual(["perf", "a11y"]);
  });

  it("falls back to config checks when no forcedChecks or input checks", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ checks: ["semantic"] }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.checks).toEqual(["semantic"]);
  });

  it("throws ConfigError for an invalid check category in input.checks", async () => {
    await expect(
      resolveMcpAuditOptions({ url: "https://example.com", checks: "a11y,notacheck" }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("resolveMcpAuditOptions -- threshold validation", () => {
  it("throws ConfigError when input threshold is out of range", async () => {
    await expect(
      resolveMcpAuditOptions({ url: "https://example.com", threshold: 150 }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws ConfigError when input threshold is NaN", async () => {
    await expect(
      resolveMcpAuditOptions({ url: "https://example.com", threshold: Number.NaN }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("resolveMcpAuditOptions -- other options", () => {
  it("uses threshold from input", async () => {
    const result = await resolveMcpAuditOptions({ url: "https://example.com", threshold: 80 });
    expect(result.threshold).toBe(80);
  });

  it("falls back to threshold from config", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ threshold: 90 }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.threshold).toBe(90);
  });

  it("input threshold overrides config threshold", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ threshold: 90 }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com", threshold: 70 });
    expect(result.threshold).toBe(70);
  });

  it("applies throttling from config", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ throttling: "mobile" }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.throttling).toBe("mobile");
  });

  it("applies concurrency from config", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ concurrency: 3 }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.concurrency).toBe(3);
  });

  it("applies excludeFramework from config", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ exclude_framework: true }));
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.excludeFramework).toBe(true);
  });

  it("uses defaults when no config is present", async () => {
    const result = await resolveMcpAuditOptions({ url: "https://example.com" });
    expect(result.throttling).toBe("none");
    expect(result.concurrency).toBe(1);
    expect(result.excludeFramework).toBe(false);
    expect(result.threshold).toBeUndefined();
  });
});
