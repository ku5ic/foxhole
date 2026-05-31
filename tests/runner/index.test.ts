import { describe, it, expect, vi, beforeEach } from "vitest";

import { runAudit, runWithConcurrency } from "../../src/runner/index.js";
import { createBrowser, createPage } from "../../src/runner/browser.js";
import { runAxe } from "../../src/runner/axe.js";
import { runSemanticChecks } from "../../src/runner/semantic.js";
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

describe("runAudit - navigation failure", () => {
  it("emits an errored PageResult shaped per spec when browser creation fails", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser).mockRejectedValue(new RunnerError("Failed to launch browser"));

    const results = await runAudit({
      urls: ["https://example.com/a"],
      checks: ["a11y", "perf"],
      quiet: true,
      concurrency: 1,
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
      concurrency: 1,
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
      concurrency: 1,
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
        concurrency: 1,
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

describe("runAudit - per-category error isolation", () => {
  beforeEach(() => {
    vi.mocked(createBrowser).mockResolvedValue(makeFakeBrowser() as never);
  });

  it("produces an errored category for the failed runner and keeps page status ok", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(runAxe).mockRejectedValueOnce(new RunnerError("Failed to run axe-core"));

    const results = await runAudit({
      urls: ["https://example.com"],
      checks: ["a11y", "semantic"],
      quiet: true,
      concurrency: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("ok");

    const errored = results[0]?.categories.filter((c) => c.status === "errored");
    expect(errored).toHaveLength(1);
    expect(errored?.[0]?.category).toBe("a11y");
    expect(errored?.[0]?.error?.message).toBe("Failed to run axe-core");
  });

  it("successful runners still contribute findings when a sibling runner fails", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(runAxe).mockRejectedValueOnce(new RunnerError("Failed to run axe-core"));
    vi.mocked(runSemanticChecks).mockResolvedValueOnce({
      findings: [
        {
          id: "abcdef1234567890",
          category: "semantic",
          severity: "minor",
          effort: "low",
          rule_id: "semantic/missing-h1",
          title: "Missing h1",
          description: "No h1 found.",
          recommendation: "Add an h1.",
          selector: null,
          wcag: null,
          impact: null,
          source: null,
          url: "https://example.com",
        },
      ],
    });

    const results = await runAudit({
      urls: ["https://example.com"],
      checks: ["a11y", "semantic"],
      quiet: true,
      concurrency: 1,
    });

    expect(results[0]?.findings).toHaveLength(1);
    expect(results[0]?.findings[0]?.category).toBe("semantic");
  });

  it("page status stays ok even when multiple runners fail", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(runAxe).mockRejectedValueOnce(new RunnerError("axe failed"));
    vi.mocked(runSemanticChecks).mockRejectedValueOnce(new RunnerError("semantic failed"));

    const results = await runAudit({
      urls: ["https://example.com"],
      checks: ["a11y", "semantic"],
      quiet: true,
      concurrency: 1,
    });

    expect(results[0]?.status).toBe("ok");
    expect(results[0]?.categories.every((c) => c.status === "errored")).toBe(true);
    expect(results[0]?.categories).toHaveLength(2);
  });
});

describe("runAudit - duration_ms", () => {
  beforeEach(() => {
    vi.mocked(createBrowser).mockResolvedValue(makeFakeBrowser() as never);
  });

  it("populates duration_ms as a non-negative integer on a successful page", async () => {
    const results = await runAudit({
      urls: ["https://example.com"],
      checks: ["a11y"],
      quiet: true,
      concurrency: 1,
    });

    expect(results[0]?.duration_ms).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(results[0]?.duration_ms)).toBe(true);
  });

  it("populates duration_ms on a navigation-failed page", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(createBrowser).mockRejectedValueOnce(new RunnerError("Failed to launch browser"));

    const results = await runAudit({
      urls: ["https://example.com"],
      checks: ["a11y"],
      quiet: true,
      concurrency: 1,
    });

    expect(results[0]?.duration_ms).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(results[0]?.duration_ms)).toBe(true);
  });
});

describe("runAudit - perf-noise warning", () => {
  beforeEach(() => {
    vi.mocked(createBrowser).mockResolvedValue(makeFakeBrowser() as never);
  });

  it("emits the perf-noise warning when concurrency > 1 and perf is checked", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAudit({
      urls: ["https://example.com/a", "https://example.com/b"],
      checks: ["perf", "a11y"],
      quiet: true,
      concurrency: 2,
    });

    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("--concurrency > 1 with perf checks"),
    );
  });

  it("does not emit the warning when concurrency is 1", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAudit({
      urls: ["https://example.com"],
      checks: ["perf"],
      quiet: true,
      concurrency: 1,
    });

    const perfWarningCalls = stderr.mock.calls.filter((args) =>
      String(args[0]).includes("--concurrency > 1"),
    );
    expect(perfWarningCalls).toHaveLength(0);
  });

  it("does not emit the warning when concurrency > 1 but perf is not checked", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAudit({
      urls: ["https://example.com/a", "https://example.com/b"],
      checks: ["a11y"],
      quiet: true,
      concurrency: 2,
    });

    const perfWarningCalls = stderr.mock.calls.filter((args) =>
      String(args[0]).includes("--concurrency > 1"),
    );
    expect(perfWarningCalls).toHaveLength(0);
  });
});

describe("runWithConcurrency", () => {
  it("returns results in input order regardless of completion order", async () => {
    const delays = [30, 10, 20];
    const urls = ["a", "b", "c"];
    const results = await runWithConcurrency(urls, 3, async (url) => {
      const delay = delays[urls.indexOf(url)] ?? 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return url;
    });
    expect(results).toEqual(["a", "b", "c"]);
  });

  it("limits in-flight work to the concurrency cap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const urls = ["a", "b", "c", "d", "e"];

    await runWithConcurrency(urls, 2, async (url) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return url;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("returns an empty array for an empty URL list", async () => {
    const results = await runWithConcurrency([], 3, async (url) => url);
    expect(results).toEqual([]);
  });

  it("uses fewer workers than concurrency when there are fewer URLs", async () => {
    let peakInFlight = 0;
    let inFlight = 0;
    const urls = ["a"];

    await runWithConcurrency(urls, 5, async (url) => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      inFlight--;
      return url;
    });

    expect(peakInFlight).toBe(1);
  });
});
