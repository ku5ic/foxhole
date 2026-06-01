import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compareRunsTool } from "../../src/mcp/tools/compare_runs.js";
import { generateReportTool } from "../../src/mcp/tools/generate_report.js";
import { getPrioritizedFixesTool } from "../../src/mcp/tools/get_prioritized_fixes.js";
import { runAccessibilityAuditTool } from "../../src/mcp/tools/run_accessibility_audit.js";
import { runFullAuditTool } from "../../src/mcp/tools/run_full_audit.js";

// Scope: prove that no code path owned by Foxhole writes to process.stdout during
// a tool invocation. Stdout belongs exclusively to the MCP protocol wire.
//
// Boundary note: Lighthouse's internal logger writes to process.stderr in library
// mode, not stdout. This is asserted by code analysis (logLevel "error" + output
// "json" + library mode = result via Promise, not printed). It cannot be proven
// by a unit test without a real browser, so audit-launching tools are tested with
// buildAuditReport mocked. The mock proves the Foxhole-owned paths; a real
// integration run is required to confirm Lighthouse itself stays off stdout.

vi.mock("../../src/audit/index.js", () => ({
  buildAuditReport: vi.fn(),
}));

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const sampleReport = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/sample-report.json"), "utf8"),
) as unknown;

describe("stdout cleanliness: sync tool handlers", () => {
  let captured: Buffer[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    captured = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    });
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    vi.restoreAllMocks();
  });

  it("get_prioritized_fixes writes nothing to stdout on valid input", () => {
    getPrioritizedFixesTool.handler({ report_json: JSON.stringify(sampleReport) });
    expect(captured).toHaveLength(0);
  });

  it("get_prioritized_fixes writes nothing to stdout on invalid input (throws, not prints)", () => {
    expect(() => getPrioritizedFixesTool.handler({ report_json: "bad json" })).toThrow();
    expect(captured).toHaveLength(0);
  });

  it("compare_runs writes nothing to stdout on valid input", () => {
    const json = JSON.stringify(sampleReport);
    compareRunsTool.handler({ before_json: json, after_json: json });
    expect(captured).toHaveLength(0);
  });

  it("generate_report writes nothing to stdout on valid input", () => {
    generateReportTool.handler({ report_json: JSON.stringify(sampleReport), format: "json" });
    expect(captured).toHaveLength(0);
  });
});

describe("stdout cleanliness: audit-launching tool handlers (buildAuditReport mocked)", () => {
  let captured: Buffer[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(async () => {
    captured = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    });

    const { buildAuditReport } = await import("../../src/audit/index.js");
    vi.mocked(buildAuditReport).mockResolvedValue(
      sampleReport as Awaited<ReturnType<typeof buildAuditReport>>,
    );
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    vi.restoreAllMocks();
  });

  it("run_full_audit writes nothing to stdout", async () => {
    await runFullAuditTool.handler({ url: "https://example.com" });
    expect(captured).toHaveLength(0);
  });

  it("run_accessibility_audit writes nothing to stdout", async () => {
    await runAccessibilityAuditTool.handler({ url: "https://example.com" });
    expect(captured).toHaveLength(0);
  });
});
