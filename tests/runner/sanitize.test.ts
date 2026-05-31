import { describe, it, expect } from "vitest";

import { sanitizeSelector } from "../../src/runner/sanitize.js";

describe("sanitizeSelector", () => {
  it("returns the string unchanged when there are no special characters", () => {
    expect(sanitizeSelector("#app .content button")).toBe("#app .content button");
  });

  it("removes angle brackets", () => {
    expect(sanitizeSelector("<div>")).toBe("div");
  });

  it("removes backticks", () => {
    expect(sanitizeSelector("`code`")).toBe("code");
  });

  it("removes all three forbidden characters in one pass", () => {
    expect(sanitizeSelector("<`>`")).toBe("");
  });

  it("returns an empty string for an empty input", () => {
    expect(sanitizeSelector("")).toBe("");
  });

  it("truncates to exactly 200 characters", () => {
    const long = "a".repeat(201);
    expect(sanitizeSelector(long)).toHaveLength(200);
  });

  it("does not truncate a string of exactly 200 characters", () => {
    const exact = "a".repeat(200);
    expect(sanitizeSelector(exact)).toBe(exact);
  });

  it("removes special characters before measuring the 200-character limit", () => {
    // 200 backticks stripped entirely -> empty, not a 200-char string
    expect(sanitizeSelector("`".repeat(200))).toBe("");
  });
});
