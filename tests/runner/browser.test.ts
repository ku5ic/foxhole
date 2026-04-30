import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Browser, Page } from "playwright";

import { createBrowser, createPage, waitForPageReady } from "../../src/runner/browser.js";
import { RunnerError } from "../../src/errors.js";

const { mockLaunch } = vi.hoisted(() => ({ mockLaunch: vi.fn() }));

vi.mock("playwright", () => ({
  chromium: { launch: mockLaunch },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBrowser", () => {
  it("throws RunnerError with the original cause when chromium.launch rejects", async () => {
    const cause = new Error("playwright launch failed");
    mockLaunch.mockRejectedValue(cause);

    await expect(createBrowser()).rejects.toMatchObject({
      message: "Failed to launch browser",
      cause,
    });
    await expect(createBrowser()).rejects.toBeInstanceOf(RunnerError);
  });
});

describe("createPage", () => {
  it("throws RunnerError with the original cause when browser.newPage rejects", async () => {
    const cause = new Error("page creation failed");
    const browser = {
      newPage: vi.fn().mockRejectedValue(cause),
    } as unknown as Browser;

    await expect(createPage(browser)).rejects.toMatchObject({
      message: "Failed to create browser page",
      cause,
    });
    await expect(createPage(browser)).rejects.toBeInstanceOf(RunnerError);
  });
});

describe("waitForPageReady", () => {
  it("throws RunnerError with the original cause when waitForLoadState rejects", async () => {
    const cause = new Error("networkidle timeout");
    const page = {
      waitForLoadState: vi.fn().mockRejectedValue(cause),
      waitForTimeout: vi.fn(),
    } as unknown as Page;

    await expect(waitForPageReady(page)).rejects.toMatchObject({
      message: "Page did not reach ready state",
      cause,
    });
    await expect(waitForPageReady(page)).rejects.toBeInstanceOf(RunnerError);
  });
});
