import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";

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

class ProcessExit extends Error {
  constructor(public readonly code: number) {
    super(`__exit:${String(code)}__`);
  }
}

let stderrSpy: MockInstance;

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ProcessExit(typeof code === "number" ? code : 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("handleRun input validation", () => {
  it("exits with code 2 when no input flag is provided", async () => {
    await expect(handleRun({})).rejects.toMatchObject({ code: 2 });
    expect(stderrSpy).toHaveBeenCalledWith("Error: one of --url, --urls, or --build is required\n");
  });

  it("exits with code 2 when --url and --urls are both set", async () => {
    await expect(handleRun({ url: "https://a.com", urls: "https://b.com" })).rejects.toMatchObject({
      code: 2,
    });
    expect(stderrSpy).toHaveBeenCalledWith("Error: --url and --urls are mutually exclusive\n");
  });

  it("exits with code 2 when --build and --url are both set", async () => {
    await expect(handleRun({ build: "./dist", url: "https://a.com" })).rejects.toMatchObject({
      code: 2,
    });
    expect(stderrSpy).toHaveBeenCalledWith("Error: --url and --build are mutually exclusive\n");
  });

  it("exits with code 2 when --build is set without --urls", async () => {
    await expect(handleRun({ build: "./dist" })).rejects.toMatchObject({ code: 2 });
    expect(stderrSpy).toHaveBeenCalledWith("Error: --build requires --urls\n");
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
