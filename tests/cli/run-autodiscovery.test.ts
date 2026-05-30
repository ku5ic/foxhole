import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { handleRun } from "../../src/cli/commands/run.js";
import { buildAuditReport } from "../../src/audit/index.js";
import type { AuditReport } from "../../src/types/index.js";

vi.mock("../../src/audit/index.js", () => ({
  buildAuditReport: vi.fn(),
}));

vi.mock("../../src/config/load.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    checks: ["a11y"],
    output: "markdown",
  }),
}));

// Spy on fs.access so we can make the cwd config appear to exist without touching the filesystem.
vi.mock("node:fs/promises", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...real,
    access: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

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
    throw new Error("process.exit called");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("handleRun config auto-discovery", () => {
  it("picks up foxhole.config.json in cwd when --config is not set", async () => {
    vi.mocked(buildAuditReport).mockResolvedValue(makeReport());

    await handleRun({ url: "https://example.com" });

    // The mocked loadConfig returns { checks: ["a11y"] }.
    // The resolver uses that as the checks value since --checks is not set.
    expect(buildAuditReport).toHaveBeenCalledWith(expect.objectContaining({ checks: ["a11y"] }));
  });
});
