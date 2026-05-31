import { describe, it, expect } from "vitest";

import {
  validateUrl,
  validateChecks,
  validateThreshold,
  validateConcurrency,
} from "../../src/config/validate.js";
import { ConfigError } from "../../src/errors.js";

describe("validateUrl", () => {
  it("accepts an http URL", () => {
    expect(validateUrl("http://example.com")).toBe("http://example.com");
  });

  it("accepts an https URL", () => {
    expect(validateUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  it("returns the original string unchanged", () => {
    const url = "https://staging.example.com/app";
    expect(validateUrl(url)).toBe(url);
  });

  it("rejects a file: URL", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(ConfigError);
  });

  it("rejects a javascript: URL", () => {
    expect(() => validateUrl("javascript:alert(1)")).toThrow(ConfigError);
  });

  it("rejects a data: URL", () => {
    expect(() => validateUrl("data:text/html,<h1>hi</h1>")).toThrow(ConfigError);
  });

  it("rejects a non-URL string", () => {
    expect(() => validateUrl("not-a-url")).toThrow(ConfigError);
  });

  it("error message names the rejected protocol", () => {
    expect(() => validateUrl("file:///tmp/x")).toThrow(/file:/);
  });
});

describe("validateChecks", () => {
  it("accepts all valid categories", () => {
    expect(validateChecks(["perf", "a11y", "semantic", "bundle"])).toEqual([
      "perf",
      "a11y",
      "semantic",
      "bundle",
    ]);
  });

  it("accepts a subset of categories", () => {
    expect(validateChecks(["a11y", "perf"])).toEqual(["a11y", "perf"]);
  });

  it("rejects an invalid category", () => {
    expect(() => validateChecks(["a11y", "unknown"])).toThrow(ConfigError);
  });

  it("error message names the bad value", () => {
    expect(() => validateChecks(["bad"])).toThrow(/bad/);
  });
});

describe("validateThreshold", () => {
  it("accepts 0", () => {
    expect(validateThreshold(0)).toBe(0);
  });

  it("accepts 100", () => {
    expect(validateThreshold(100)).toBe(100);
  });

  it("accepts a value in range", () => {
    expect(validateThreshold(80)).toBe(80);
  });

  it("rejects NaN", () => {
    expect(() => validateThreshold(Number.NaN)).toThrow(ConfigError);
  });

  it("rejects a value below 0", () => {
    expect(() => validateThreshold(-1)).toThrow(ConfigError);
  });

  it("rejects a value above 100", () => {
    expect(() => validateThreshold(101)).toThrow(ConfigError);
  });

  it("rejects Infinity", () => {
    expect(() => validateThreshold(Infinity)).toThrow(ConfigError);
  });
});

describe("validateConcurrency", () => {
  it("accepts 1", () => {
    expect(validateConcurrency(1)).toBe(1);
  });

  it("accepts a positive integer greater than 1", () => {
    expect(validateConcurrency(4)).toBe(4);
  });

  it("rejects 0", () => {
    expect(() => validateConcurrency(0)).toThrow(ConfigError);
  });

  it("rejects a negative integer", () => {
    expect(() => validateConcurrency(-1)).toThrow(ConfigError);
  });

  it("rejects a non-integer", () => {
    expect(() => validateConcurrency(1.5)).toThrow(ConfigError);
  });

  it("error message names the bad value", () => {
    expect(() => validateConcurrency(0)).toThrow(/0/);
  });
});
