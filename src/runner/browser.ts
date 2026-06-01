import fs from "node:fs/promises";
import net from "node:net";

import { chromium } from "playwright";
import type { Browser, BrowserServer, Page } from "playwright";

import { RunnerError } from "../errors.js";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_BUFFER_MS = 500;

// Asks the OS for a free TCP port by binding to :0 and reading back the
// assigned port. The probe closes before Chrome binds, so there is a small
// TOCTOU window; under concurrency > 1 with perf checks the existing warning
// already nudges users toward concurrency 1.
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close(() => {
          reject(new RunnerError("Could not determine free port"));
        });
        return;
      }
      const { port } = address;
      probe.close((err) => {
        if (err) {
          reject(new RunnerError("Failed to close port probe", err));
        } else {
          resolve(port);
        }
      });
    });
    probe.on("error", (err) => {
      reject(new RunnerError("Failed to probe for free port", err));
    });
  });
}

// Returns the Playwright browser, the BrowserServer (needed for server.close()),
// and the Chrome CDP port that Lighthouse should connect to.
async function createBrowser(): Promise<{
  browser: Browser;
  server: BrowserServer;
  cdpPort: number;
}> {
  const execPath = chromium.executablePath();
  try {
    await fs.access(execPath);
  } catch {
    throw new RunnerError("Chromium is not installed. Run: npx playwright install chromium");
  }

  let server: BrowserServer | undefined;
  try {
    const cdpPort = await findFreePort();
    server = await chromium.launchServer({
      headless: true,
      args: ["--disable-dev-shm-usage", `--remote-debugging-port=${String(cdpPort)}`],
    });
    const browser = await chromium.connect(server.wsEndpoint());
    return { browser, server, cdpPort };
  } catch (cause) {
    try {
      await server?.close();
    } catch {
      // ignore cleanup error; the original cause is what matters
    }
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

export { findFreePort, createBrowser, createPage, waitForPageReady };
export type { BrowserServer } from "playwright";
