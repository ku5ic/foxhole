import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_BUFFER_MS = 500;

async function createBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  return browser;
}

async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    viewport: DEFAULT_VIEWPORT,
  });
  page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);
  return page;
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(NETWORK_IDLE_BUFFER_MS);
}

export { createBrowser, createPage, waitForPageReady };
