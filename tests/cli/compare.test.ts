import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";

import { ConfigError } from "../../src/errors.js";
import { handleCompare } from "../../src/cli/commands/compare.js";
import { readAuditReport } from "../../src/audit/read-report.js";
import { diffReports } from "../../src/audit/diff.js";
import type { RunDiff } from "../../src/types/index.js";

vi.mock("../../src/audit/read-report.js", () => ({
  readAuditReport: vi.fn(),
}));

vi.mock("../../src/audit/diff.js", () => ({
  diffReports: vi.fn(),
}));

function makeDiff(scoreDelta: number): RunDiff {
  return {
    before_meta: {
      foxhole_version: "0.0.0",
      audited_at: "2026-01-01T00:00:00.000Z",
      perf_profile: "none",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
    after_meta: {
      foxhole_version: "0.0.0",
      audited_at: "2026-01-02T00:00:00.000Z",
      perf_profile: "none",
      dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" },
    },
    comparable: true,
    comparability_notes: [],
    score_delta: scoreDelta,
    passed: scoreDelta >= 0,
    regressions: [],
    improvements: [],
    unchanged: [],
    metrics_delta: {},
    summary: "test diff",
  };
}

let stdoutSpy: MockInstance;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit must not be called from handleCompare");
  });
  vi.mocked(readAuditReport).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("handleCompare: no threshold", () => {
  it("resolves to 0 and writes JSON when no threshold is given", async () => {
    vi.mocked(diffReports).mockReturnValue(makeDiff(-5));

    const code = await handleCompare("a.json", "b.json", {});

    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledOnce();
  });
});

describe("handleCompare: threshold behavior", () => {
  it("resolves to 0 when score_delta equals threshold", async () => {
    vi.mocked(diffReports).mockReturnValue(makeDiff(0));

    const code = await handleCompare("a.json", "b.json", { threshold: 0 });

    expect(code).toBe(0);
  });

  it("resolves to 0 when score_delta is above threshold", async () => {
    vi.mocked(diffReports).mockReturnValue(makeDiff(5));

    const code = await handleCompare("a.json", "b.json", { threshold: 0 });

    expect(code).toBe(0);
  });

  it("resolves to 1 when score_delta is below threshold", async () => {
    vi.mocked(diffReports).mockReturnValue(makeDiff(-3));

    const code = await handleCompare("a.json", "b.json", { threshold: 0 });

    expect(code).toBe(1);
  });

  it("resolves to 1 when a positive threshold requires improvement and none occurred", async () => {
    vi.mocked(diffReports).mockReturnValue(makeDiff(2));

    const code = await handleCompare("a.json", "b.json", { threshold: 5 });

    expect(code).toBe(1);
  });
});

describe("handleCompare: threshold validation", () => {
  it("throws ConfigError for a NaN threshold", async () => {
    const p = handleCompare("a.json", "b.json", { threshold: Number.NaN });
    await expect(p).rejects.toThrow(ConfigError);
    await expect(p).rejects.toThrow("--threshold must be a number");
  });
});

describe("handleCompare: read failure propagates", () => {
  it("rejects when readAuditReport throws", async () => {
    vi.mocked(readAuditReport).mockRejectedValue(new Error("file not found"));

    await expect(handleCompare("missing.json", "b.json", {})).rejects.toThrow("file not found");
  });
});

describe("handleCompare: diff failure propagates", () => {
  it("rejects when diffReports throws", async () => {
    vi.mocked(diffReports).mockImplementation(() => {
      throw new Error("incompatible report versions");
    });

    await expect(handleCompare("a.json", "b.json", {})).rejects.toThrow(
      "incompatible report versions",
    );
  });
});
