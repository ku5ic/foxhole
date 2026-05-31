import { describe, it, expect } from "vitest";

import { foxholeConfigSchema } from "../../src/config/schema.js";

describe("foxholeConfigSchema", () => {
  it("accepts a valid full config with all fields", () => {
    const config = {
      url: "https://example.com",
      urls: ["https://a.com", "https://b.com"],
      checks: ["perf", "a11y"],
      output: "json",
      out: "./report.json",
      threshold: 80,
    };

    const result = foxholeConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts an empty object with defaults", () => {
    const result = foxholeConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checks).toEqual(["perf", "a11y", "semantic", "bundle"]);
      expect(result.data.output).toBe("markdown");
    }
  });

  it("accepts a config with only threshold", () => {
    const result = foxholeConfigSchema.safeParse({ threshold: 90 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid URL format", () => {
    const result = foxholeConfigSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects threshold below 0", () => {
    const result = foxholeConfigSchema.safeParse({ threshold: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects threshold above 100", () => {
    const result = foxholeConfigSchema.safeParse({ threshold: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid check category", () => {
    const result = foxholeConfigSchema.safeParse({ checks: ["invalid"] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid output format", () => {
    const result = foxholeConfigSchema.safeParse({ output: "pdf" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key (strict mode)", () => {
    const result = foxholeConfigSchema.safeParse({ threshold: 80, unknownKey: true });
    expect(result.success).toBe(false);
  });

  it("accepts exclude_framework: true", () => {
    const result = foxholeConfigSchema.safeParse({ exclude_framework: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.exclude_framework).toBe(true);
  });

  it("defaults exclude_framework to false when absent", () => {
    const result = foxholeConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.exclude_framework).toBe(false);
  });

  it("rejects a non-boolean exclude_framework", () => {
    const result = foxholeConfigSchema.safeParse({ exclude_framework: "yes" });
    expect(result.success).toBe(false);
  });
});
