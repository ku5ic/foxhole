import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

import { RunnerError } from "../errors.js";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_BUFFER_MS = 500;

async function createBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
  } catch (cause) {
    throw new RunnerError("Failed to launch browser", cause);
  }
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

export { createBrowser, createPage, waitForPageReady };
