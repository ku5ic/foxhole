import { describe, it, expect, vi, beforeEach } from "vitest";

import { runAudit } from "../../src/runner/index.js";
import { createBrowser, createPage } from "../../src/runner/browser.js";
import { RunnerError } from "../../src/errors.js";

vi.mock("../../src/runner/browser.js", () => ({
  createBrowser: vi.fn(),
  createPage: vi.fn(),
  waitForPageReady: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/runner/axe.js", () => ({
  runAxe: vi.fn().mockResolvedValue({ findings: [] }),
}));

vi.mock("../../src/runner/lighthouse.js", () => ({
  runLighthouse: vi.fn().mockResolvedValue({
    metrics: {
      lcp: null,
      fid: null,
      cls: null,
      fcp: null,
      ttfb: null,
      tbt: null,
      performance_score: null,
      accessibility_score: null,
      bundle_size: null,
    },
    findings: [],
  }),
}));

vi.mock("../../src/runner/semantic.js", () => ({
  runSemanticChecks: vi.fn().mockResolvedValue({ findings: [] }),
}));

vi.mock("../../src/runner/bundle.js", () => ({
  runBundleChecks: vi.fn().mockResolvedValue({ findings: [], bundle_size: null }),
}));

interface FakePage {
  goto: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface FakeBrowser {
  close: ReturnType<typeof vi.fn>;
}

function makeFakePage(): FakePage {
  return {
    goto: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
}

function makeFakeBrowser(): FakeBrowser {
  return {
    close: vi.fn(() => Promise.resolve()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPage).mockImplementation(() => Promise.resolve(makeFakePage() as never));
});

describe("runAudit", () => {
  it("emits an errored PageResult shaped per spec when a runner throws", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser).mockRejectedValue(new RunnerError("Failed to launch browser"));

    const results = await runAudit({
      urls: ["https://example.com/a"],
      checks: ["a11y", "perf"],
      quiet: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      url: "https://example.com/a",
      status: "errored",
      error: { message: "Failed to launch browser" },
      score: 0,
      findings: [],
    });
    expect(results[0]?.categories).toHaveLength(2);
    expect(results[0]?.categories.every((c) => c.status === "errored")).toBe(true);
    expect(results[0]?.categories[0]?.error).toEqual({
      message: "Failed to launch browser",
    });

    expect(stderr).toHaveBeenCalledWith(
      "[foxhole] failed https://example.com/a: Failed to launch browser\n",
    );
  });

  it("continues to the next URL when one page throws", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser)
      .mockRejectedValueOnce(new RunnerError("Failed to launch browser"))
      .mockResolvedValueOnce(makeFakeBrowser() as never);

    const results = await runAudit({
      urls: ["https://example.com/a", "https://example.com/b"],
      checks: ["a11y"],
      quiet: true,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("errored");
    expect(results[0]?.url).toBe("https://example.com/a");
    expect(results[1]?.status).toBe("ok");
    expect(results[1]?.url).toBe("https://example.com/b");
  });

  it("returns one errored entry per URL when every page fails, without throwing", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser).mockRejectedValue(new RunnerError("Failed to launch browser"));

    const results = await runAudit({
      urls: ["a", "b", "c"],
      checks: ["semantic"],
      quiet: true,
    });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === "errored")).toBe(true);
  });

  it("propagates non-RunnerError so programming errors are not silently swallowed", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser).mockRejectedValue(new TypeError("not a runner error"));

    await expect(
      runAudit({
        urls: ["https://example.com/a"],
        checks: ["a11y"],
        quiet: true,
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
