import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/audit/index.js", () => ({
  buildAuditReport: vi.fn(),
}));

vi.mock("../../src/config/discover.js", () => ({
  discoverConfig: vi.fn(),
}));

import { buildAuditReport } from "../../src/audit/index.js";
import { discoverConfig } from "../../src/config/discover.js";
import { runFullAuditTool } from "../../src/mcp/tools/run_full_audit.js";
import { runAccessibilityAuditTool } from "../../src/mcp/tools/run_accessibility_audit.js";
import { runPerformanceAuditTool } from "../../src/mcp/tools/run_performance_audit.js";
import type { AuditReport } from "../../src/types/index.js";
import type { FoxholeConfig } from "../../src/config/schema.js";
import type { DiscoveredConfig } from "../../src/config/discover.js";

function makeReport(): AuditReport {
  return {
    version: 1,
    summary: "test",
    score: 100,
    pages: [],
    prioritized_fixes: [],
    meta: {
      foxhole_version: "test",
      node_version: "test",
      platform: "test-arm64",
      audited_at: "2026-06-01T00:00:00.000Z",
      input_mode: "url",
      checks_run: [],
      page_count: 0,
      duration_ms: 0,
      threshold: null,
      passed: true,
      concurrency: 1,
      perf_runs: 1,
      perf_profile: "none",
      source_maps: "auto",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
  };
}

function makeDiscovered(overrides: Partial<FoxholeConfig> = {}): DiscoveredConfig {
  return {
    config: {
      checks: ["perf", "a11y", "semantic", "bundle"],
      output: "markdown",
      exclude_framework: false,
      ...overrides,
    },
    path: "/project/foxhole.config.json",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(discoverConfig).mockResolvedValue(undefined as never);
  vi.mocked(buildAuditReport).mockResolvedValue(makeReport());
});

describe("run_full_audit handler", () => {
  it("calls buildAuditReport with resolved url and returns report JSON", async () => {
    const result = await runFullAuditTool.handler({ url: "https://example.com" });
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ["https://example.com"],
        inputMode: "url",
        quiet: true,
      }),
    );
    expect((): void => {
      JSON.parse(result);
    }).not.toThrow();
  });

  it("uses config url when no url is provided in input", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ url: "https://config.com/" }));
    await runFullAuditTool.handler({});
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ urls: ["https://config.com/"] }),
    );
  });

  it("applies config threshold when not in input", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ threshold: 85 }));
    await runFullAuditTool.handler({ url: "https://example.com" });
    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ threshold: 85 }));
  });

  it("resolves comma-separated urls input into a list with inputMode urls", async () => {
    await runFullAuditTool.handler({ urls: "https://a.com, https://b.com" });
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ["https://a.com", "https://b.com"],
        inputMode: "urls",
      }),
    );
  });

  it("throws when no url is provided and no config is present", async () => {
    await expect(runFullAuditTool.handler({})).rejects.toThrow();
  });
});

describe("run_accessibility_audit handler", () => {
  it("calls buildAuditReport with a11y check and returns findings JSON", async () => {
    const result = await runAccessibilityAuditTool.handler({ url: "https://example.com" });
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ["https://example.com"],
        checks: ["a11y"],
        quiet: true,
      }),
    );
    expect(JSON.parse(result)).toEqual([]);
  });

  it("uses config url when no url is provided in input", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ url: "https://config.com/" }));
    await runAccessibilityAuditTool.handler({});
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ urls: ["https://config.com/"], checks: ["a11y"] }),
    );
  });

  it("throws when no url is provided and no config is present", async () => {
    await expect(runAccessibilityAuditTool.handler({})).rejects.toThrow();
  });
});

describe("run_performance_audit handler", () => {
  it("calls buildAuditReport with perf check and returns result shape", async () => {
    const result = await runPerformanceAuditTool.handler({ url: "https://example.com" });
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ["https://example.com"],
        checks: ["perf"],
        quiet: true,
      }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed).toHaveProperty("categories");
    expect(parsed).toHaveProperty("findings");
    expect(parsed).toHaveProperty("metrics");
  });

  it("uses config url when no url is provided in input", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(makeDiscovered({ url: "https://config.com/" }));
    await runPerformanceAuditTool.handler({});
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ urls: ["https://config.com/"], checks: ["perf"] }),
    );
  });

  it("throws when no url is provided and no config is present", async () => {
    await expect(runPerformanceAuditTool.handler({})).rejects.toThrow();
  });
});
