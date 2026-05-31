import { chromium } from "playwright";
import type { Browser, BrowserServer, Page } from "playwright";

import { RunnerError } from "../errors.js";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_BUFFER_MS = 500;

// Returns both the Playwright browser and the BrowserServer so callers can
// extract the CDP port (via server.wsEndpoint()) for Lighthouse and close the
// server process after audit work is complete.
async function createBrowser(): Promise<{ browser: Browser; server: BrowserServer }> {
  let server: BrowserServer | undefined;
  try {
    server = await chromium.launchServer({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
    const browser = await chromium.connect(server.wsEndpoint());
    return { browser, server };
  } catch (cause) {
    try {
      await server?.close();
    } catch {
      // ignore cleanup error; the original cause is what matters
    }
    throw new RunnerError("Failed to launch browser", cause);
  }
}

// Parses the CDP port out of a Playwright browser server wsEndpoint URL.
// Format: ws://127.0.0.1:<port>/devtools/browser/<uuid>
function extractCdpPort(wsEndpoint: string): number {
  let parsed: URL;
  try {
    parsed = new URL(wsEndpoint);
  } catch {
    throw new RunnerError(`Cannot parse browser wsEndpoint: ${wsEndpoint}`);
  }
  const port = Number.parseInt(parsed.port, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new RunnerError(`Browser wsEndpoint has no usable CDP port: ${wsEndpoint}`);
  }
  return port;
}

async function createPage(browser: Browser): Promise<Page> {
  try {
    const page = await browser.newPage({
      viewport: DEFAULT_VIEWPORT,
    });
    page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);
    return page;
  } catch (cause) {
    throw new RunnerError("Failed to create browser page", cause);
  }
}

async function waitForPageReady(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(NETWORK_IDLE_BUFFER_MS);
  } catch (cause) {
    throw new RunnerError("Page did not reach ready state", cause);
  }
}

export { createBrowser, createPage, waitForPageReady, extractCdpPort };
export type { BrowserServer } from "playwright";
