import { describe, it, expect } from "vitest";

import { ConfigError, RunnerError } from "../../src/errors.js";
import { errorResult } from "../../src/mcp/index.js";

describe("errorResult", () => {
  it("returns MCP content shape with a text entry", () => {
    const result = errorResult(new Error("boom"));
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
  });

  it("text is valid JSON with an error key", () => {
    const result = errorResult(new Error("boom"));
    const parsed: unknown = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("error");
  });

  it("includes the error message for a standard Error", () => {
    const result = errorResult(new Error("something broke"));
    expect(result.content[0].text).toContain("something broke");
  });

  it("includes the message for a ConfigError", () => {
    const result = errorResult(new ConfigError("bad config"));
    expect(result.content[0].text).toContain("bad config");
  });

  it("includes the message for a RunnerError", () => {
    const result = errorResult(new RunnerError("runner failed"));
    expect(result.content[0].text).toContain("runner failed");
  });

  it("handles non-Error thrown values", () => {
    const result = errorResult("a raw string error");
    const parsed: unknown = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("error");
  });
});
