import { describe, it, expect } from "vitest";

import { getPrioritizedFixesTool } from "../../src/mcp/tools/get_prioritized_fixes.js";
import { compareRunsTool } from "../../src/mcp/tools/compare_runs.js";
import { generateReportTool } from "../../src/mcp/tools/generate_report.js";
import { ConfigError } from "../../src/errors.js";

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
