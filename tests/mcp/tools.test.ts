import { describe, expect, it, vi } from "vitest";

import { ConfigError, RunnerError } from "../../src/errors.js";
import { compareRunsTool } from "../../src/mcp/tools/compare_runs.js";
import { generateReportTool } from "../../src/mcp/tools/generate_report.js";
import { getPrioritizedFixesTool } from "../../src/mcp/tools/get_prioritized_fixes.js";
import { runAccessibilityAuditTool } from "../../src/mcp/tools/run_accessibility_audit.js";
import { runFullAuditTool } from "../../src/mcp/tools/run_full_audit.js";

vi.mock("../../src/audit/index.js", () => ({
  buildAuditReport: vi.fn(),
}));

// These handlers now throw ConfigError on bad input rather than crashing with a
// runtime type error. The MCP index catches and formats the error; here we verify
// the throw itself, which is what the index wraps.

describe("get_prioritized_fixes handler validation", () => {
  it("throws ConfigError when report_json is not valid JSON", () => {
    expect(() => getPrioritizedFixesTool.handler({ report_json: "not json" })).toThrow(ConfigError);
  });

  it("throws ConfigError when report_json is valid JSON but not an AuditReport", () => {
    expect(() =>
      getPrioritizedFixesTool.handler({ report_json: JSON.stringify({ wrong: "shape" }) }),
    ).toThrow(ConfigError);
  });
});

describe("compare_runs handler validation", () => {
  it("throws ConfigError when before_json is not valid JSON", () => {
    expect(() => compareRunsTool.handler({ before_json: "bad", after_json: "{}" })).toThrow(
      ConfigError,
    );
  });

  it("throws ConfigError when after_json is not a valid AuditReport", () => {
    const validReport = JSON.stringify({ version: 1 });
    expect(() => compareRunsTool.handler({ before_json: "bad", after_json: validReport })).toThrow(
      ConfigError,
    );
  });
});

describe("generate_report handler validation", () => {
  it("throws ConfigError when report_json is not valid JSON", () => {
    expect(() =>
      generateReportTool.handler({ report_json: "bad json", format: "markdown" }),
    ).toThrow(ConfigError);
  });

  it("throws ConfigError when report_json is valid JSON but not an AuditReport", () => {
    expect(() =>
      generateReportTool.handler({
        report_json: JSON.stringify({ not: "an audit report" }),
        format: "markdown",
      }),
    ).toThrow(ConfigError);
  });
});

// Async audit tools: errors from the audit layer must propagate as rejections so
// the MCP server's errorResult wrapper can catch and format them. An unhandled
// throw that escapes the server boundary would silently break the MCP client.

describe("run_full_audit handler: audit-layer errors propagate", () => {
  it("rejects when buildAuditReport throws a RunnerError", async () => {
    const { buildAuditReport } = await import("../../src/audit/index.js");
    vi.mocked(buildAuditReport).mockRejectedValue(new RunnerError("browser failed"));
    await expect(runFullAuditTool.handler({ url: "https://example.com" })).rejects.toThrow(
      RunnerError,
    );
  });
});

describe("run_accessibility_audit handler: audit-layer errors propagate", () => {
  it("rejects when buildAuditReport throws a RunnerError", async () => {
    const { buildAuditReport } = await import("../../src/audit/index.js");
    vi.mocked(buildAuditReport).mockRejectedValue(new RunnerError("browser failed"));
    await expect(runAccessibilityAuditTool.handler({ url: "https://example.com" })).rejects.toThrow(
      RunnerError,
    );
  });
});
