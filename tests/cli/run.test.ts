import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ConfigError } from "../../src/errors.js";
import { handleRun } from "../../src/cli/commands/run.js";
import { serveStaticBuild } from "../../src/server/static.js";
import { buildAuditReport } from "../../src/audit/index.js";
import type { AuditReport } from "../../src/types/index.js";

vi.mock("../../src/server/static.js", () => ({
  serveStaticBuild: vi.fn(),
}));

vi.mock("../../src/audit/index.js", () => ({
  buildAuditReport: vi.fn(),
}));

// Disable cwd config auto-discovery so these tests are not affected by a real foxhole.config.json.
vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
    writeFile: vi.fn().mockResolvedValue(null),
  },
}));

function makeReport(passed = true): AuditReport {
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
      audited_at: "2026-04-07T00:00:00.000Z",
      input_mode: "url",
      checks_run: [],
      page_count: 0,
      duration_ms: 0,
      threshold: null,
      passed,
      concurrency: 1,
      perf_runs: 1,
      perf_profile: "none",
      source_maps: "auto",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
  };
}

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit must not be called from handleRun");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("handleRun input validation", () => {
  it("throws ConfigError when no input flag is provided", async () => {
    const p = handleRun({});
    await expect(p).rejects.toThrow(ConfigError);
    await expect(p).rejects.toThrow("one of --url, --urls, or --build is required");
  });

  it("throws ConfigError when --url and --urls are both set", async () => {
    await expect(handleRun({ url: "https://a.com", urls: "https://b.com" })).rejects.toThrow(
      "--url and --urls are mutually exclusive",
    );
  });

  it("throws ConfigError when --build and --url are both set", async () => {
    await expect(handleRun({ build: "./dist", url: "https://a.com" })).rejects.toThrow(
      "--url and --build are mutually exclusive",
    );
  });

  it("throws ConfigError when --build is set without --urls", async () => {
    await expect(handleRun({ build: "./dist" })).rejects.toThrow("--build requires --urls");
  });
});

describe("handleRun --build lifecycle", () => {
  it("starts the static server, prefixes relative URLs, and closes the server after the audit", async () => {
    const close = vi.fn(() => Promise.resolve());
    vi.mocked(serveStaticBuild).mockResolvedValue({ url: "http://localhost:1234", close });
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({
      build: "./tests/fixtures/static",
      urls: "/index.html,/about.html,https://external.example.com",
    });

    expect(serveStaticBuild).toHaveBeenCalledWith("./tests/fixtures/static");
    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: [
          "http://localhost:1234/index.html",
          "http://localhost:1234/about.html",
          "https://external.example.com",
        ],
      }),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the server even when the audit throws", async () => {
    const close = vi.fn(() => Promise.resolve());
    vi.mocked(serveStaticBuild).mockResolvedValue({ url: "http://localhost:1234", close });
    vi.mocked(buildAuditReport).mockRejectedValue(new Error("audit blew up"));

    await expect(handleRun({ build: "./dist", urls: "/index.html" })).rejects.toThrow(
      "audit blew up",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not start a static server when --build is not set", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ urls: "https://example.com" });

    expect(serveStaticBuild).not.toHaveBeenCalled();
  });
});

describe("handleRun inputMode", () => {
  it("passes inputMode: 'build' to buildAuditReport when --build is set", async () => {
    const close = vi.fn(() => Promise.resolve());
    vi.mocked(serveStaticBuild).mockResolvedValue({ url: "http://localhost:1234", close });
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ build: "./dist", urls: "/index.html" });

    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ inputMode: "build" }));
  });

  it("passes inputMode: 'url' to buildAuditReport when --url is set", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com" });

    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ inputMode: "url" }));
  });

  it("passes inputMode: 'urls' to buildAuditReport when --urls is set without --build", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ urls: "https://example.com,https://example.com/about" });

    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ inputMode: "urls" }));
  });
});

describe("handleRun --throttling", () => {
  it("passes desktop throttling preset to buildAuditReport", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com", throttling: "desktop" });

    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ throttling: "desktop" }),
    );
  });

  it("passes mobile throttling preset to buildAuditReport", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com", throttling: "mobile" });

    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ throttling: "mobile" }),
    );
  });

  it("defaults to none when --throttling is not given", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com" });

    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ throttling: "none" }));
  });

  it("throws ConfigError for an invalid throttling preset", async () => {
    const p = handleRun({ url: "https://example.com", throttling: "turbo" });
    await expect(p).rejects.toThrow(ConfigError);
    await expect(p).rejects.toThrow("must be one of: desktop, mobile, none");
  });
});

describe("handleRun resolver validation", () => {
  it("throws ConfigError for an invalid --checks value", async () => {
    const p = handleRun({ url: "https://example.com", checks: "a11y,notacheck" });
    await expect(p).rejects.toThrow(ConfigError);
    await expect(p).rejects.toThrow("notacheck");
  });

  it("throws ConfigError for a NaN --threshold", async () => {
    const p = handleRun({ url: "https://example.com", threshold: Number.NaN });
    await expect(p).rejects.toThrow(ConfigError);
    await expect(p).rejects.toThrow("threshold");
  });

  it("throws ConfigError for an out-of-range --threshold", async () => {
    await expect(handleRun({ url: "https://example.com", threshold: 150 })).rejects.toThrow(
      ConfigError,
    );
  });

  it("passes checks from --checks flag to buildAuditReport", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com", checks: "a11y,perf" });

    expect(buildAuditReport).toHaveBeenCalledWith(
      expect.objectContaining({ checks: ["a11y", "perf"] }),
    );
  });
});

describe("handleRun exit code", () => {
  it("resolves to 0 when the audit passes", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport(true));

    await expect(handleRun({ url: "https://example.com" })).resolves.toBe(0);
  });

  it("resolves to 1 when the audit is below threshold", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport(false));

    await expect(handleRun({ url: "https://example.com" })).resolves.toBe(1);
  });
});
