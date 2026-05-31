import { describe, it, expect } from "vitest";

import { resolveRunOptions } from "../../src/config/resolve-options.js";
import { ConfigError } from "../../src/errors.js";

describe("resolveRunOptions - concurrency", () => {
  it("defaults to 1 when neither flag nor config provide a value", () => {
    const result = resolveRunOptions({});
    expect(result.concurrency).toBe(1);
  });

  it("uses the flag value when provided", () => {
    const result = resolveRunOptions({ concurrency: 4 });
    expect(result.concurrency).toBe(4);
  });

  it("uses the config value when the flag is absent", () => {
    const result = resolveRunOptions({}, { concurrency: 3 });
    expect(result.concurrency).toBe(3);
  });

  it("flag takes priority over the config value", () => {
    const result = resolveRunOptions({ concurrency: 2 }, { concurrency: 5 });
    expect(result.concurrency).toBe(2);
  });

  it("throws ConfigError for concurrency 0", () => {
    expect(() => resolveRunOptions({ concurrency: 0 })).toThrow(ConfigError);
  });

  it("throws ConfigError for a negative integer", () => {
    expect(() => resolveRunOptions({ concurrency: -1 })).toThrow(ConfigError);
  });

  it("throws ConfigError for a non-integer value", () => {
    expect(() => resolveRunOptions({ concurrency: 1.5 })).toThrow(ConfigError);
  });
});

describe("resolveRunOptions - excludeFramework", () => {
  it("defaults to false when neither flag nor config provide a value", () => {
    const result = resolveRunOptions({});
    expect(result.excludeFramework).toBe(false);
  });

  it("uses the flag value when provided", () => {
    const result = resolveRunOptions({ excludeFramework: true });
    expect(result.excludeFramework).toBe(true);
  });

  it("uses the config value when the flag is absent", () => {
    const result = resolveRunOptions({}, { exclude_framework: true });
    expect(result.excludeFramework).toBe(true);
  });

  it("flag takes priority over the config value", () => {
    const result = resolveRunOptions({ excludeFramework: false }, { exclude_framework: true });
    expect(result.excludeFramework).toBe(false);
  });
});

describe("resolveRunOptions - defaults", () => {
  it("uses default checks when none are provided", () => {
    const result = resolveRunOptions({});
    expect(result.checks).toEqual(["perf", "a11y", "semantic", "bundle"]);
  });

  it("uses default outputFormat when none is provided", () => {
    const result = resolveRunOptions({});
    expect(result.outputFormat).toBe("markdown");
  });

  it("uses default throttling when none is provided", () => {
    const result = resolveRunOptions({});
    expect(result.throttling).toBe("none");
  });

  it("threshold is undefined when not provided", () => {
    const result = resolveRunOptions({});
    expect(result.threshold).toBeUndefined();
  });

  it("out is undefined when not provided", () => {
    const result = resolveRunOptions({});
    expect(result.out).toBeUndefined();
  });
});
