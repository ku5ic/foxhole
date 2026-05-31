import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Browser, BrowserServer, Page } from "playwright";

import {
  createBrowser,
  createPage,
  waitForPageReady,
  extractCdpPort,
} from "../../src/runner/browser.js";
import { RunnerError } from "../../src/errors.js";

const { mockLaunchServer, mockConnect } = vi.hoisted(() => ({
  mockLaunchServer: vi.fn(),
  mockConnect: vi.fn(),
}));

vi.mock("playwright", () => ({
  chromium: { launchServer: mockLaunchServer, connect: mockConnect },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBrowser", () => {
  it("throws RunnerError with the original cause when chromium.launchServer rejects", async () => {
    const cause = new Error("server launch failed");
    mockLaunchServer.mockRejectedValue(cause);

    await expect(createBrowser()).rejects.toMatchObject({
      message: "Failed to launch browser",
      cause,
    });
    await expect(createBrowser()).rejects.toBeInstanceOf(RunnerError);
  });

  it("closes the server when chromium.connect rejects", async () => {
    const fakeServer = {
      wsEndpoint: vi.fn(() => "ws://127.0.0.1:9222/devtools/browser/test"),
      close: vi.fn(() => Promise.resolve()),
    };
    mockLaunchServer.mockResolvedValue(fakeServer);
    mockConnect.mockRejectedValue(new Error("connect failed"));

    await expect(createBrowser()).rejects.toBeInstanceOf(RunnerError);
    expect(fakeServer.close).toHaveBeenCalledOnce();
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

describe("extractCdpPort", () => {
  it("extracts the port from a valid wsEndpoint", () => {
    expect(extractCdpPort("ws://127.0.0.1:9222/devtools/browser/abc")).toBe(9222);
  });

  it("extracts a non-default port correctly", () => {
    expect(extractCdpPort("ws://127.0.0.1:54321/devtools/browser/xyz")).toBe(54321);
  });

  it("throws RunnerError when the endpoint is not a valid URL", () => {
    expect(() => extractCdpPort("not-a-url")).toThrow(RunnerError);
  });

  it("throws RunnerError when the URL has no port", () => {
    expect(() => extractCdpPort("ws://127.0.0.1/devtools/browser/abc")).toThrow(RunnerError);
  });

  it("throws RunnerError when the port is 0", () => {
    expect(() => extractCdpPort("ws://127.0.0.1:0/devtools/browser/abc")).toThrow(RunnerError);
  });

  it("error message includes the offending endpoint", () => {
    const bad = "not-a-url";
    expect(() => extractCdpPort(bad)).toThrow(bad);
  });
});
