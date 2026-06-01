import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Browser, Page } from "playwright";

import {
  findFreePort,
  createBrowser,
  createPage,
  waitForPageReady,
} from "../../src/runner/browser.js";
import { RunnerError } from "../../src/errors.js";

const { mockLaunchServer, mockConnect, mockExecPath, mockAccess } = vi.hoisted(() => ({
  mockLaunchServer: vi.fn(),
  mockConnect: vi.fn(),
  mockExecPath: vi.fn(() => "/fake/chromium"),
  mockAccess: vi.fn(() => Promise.resolve()),
}));

vi.mock("playwright", () => ({
  chromium: {
    launchServer: mockLaunchServer,
    connect: mockConnect,
    executablePath: mockExecPath,
  },
}));

vi.mock("node:fs/promises", () => ({
  default: { access: mockAccess },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBrowser", () => {
  it("throws RunnerError with install instructions when Chromium executable is missing", async () => {
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    await expect(createBrowser()).rejects.toMatchObject({
      message: "Chromium is not installed. Run: npx playwright install chromium",
    });
    await expect(createBrowser()).rejects.toBeInstanceOf(RunnerError);
  });

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

  it("returns a numeric cdpPort and passes --remote-debugging-port to launchServer", async () => {
    const fakeServer = {
      wsEndpoint: vi.fn(() => "ws://127.0.0.1:9222/devtools/browser/test"),
      close: vi.fn(() => Promise.resolve()),
    };
    const fakeBrowser = { close: vi.fn() };
    mockLaunchServer.mockResolvedValue(fakeServer);
    mockConnect.mockResolvedValue(fakeBrowser);

    const { cdpPort } = await createBrowser();

    expect(cdpPort).toBeGreaterThan(0);
    expect(Number.isInteger(cdpPort)).toBe(true);
    const launchArgs = (mockLaunchServer.mock.calls as [{ args: string[] }][])[0]?.[0]?.args;
    expect(launchArgs).toContain(`--remote-debugging-port=${String(cdpPort)}`);
  });
});

describe("findFreePort", () => {
  it("returns a positive integer", async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(0);
    expect(Number.isInteger(port)).toBe(true);
  });

  it("returns distinct ports across concurrent calls", async () => {
    const [p1, p2] = await Promise.all([findFreePort(), findFreePort()]);
    expect(p1).not.toBe(p2);
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
