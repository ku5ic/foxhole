import { describe, it, expect } from "vitest";

import { formatErrorChain } from "../src/errors.js";

describe("formatErrorChain", () => {
  it("returns the message for a plain Error", () => {
    expect(formatErrorChain(new Error("something went wrong"))).toBe("something went wrong");
  });

  it("joins the cause chain with ': '", () => {
    const inner = new Error("inner");
    const outer = new Error("outer", { cause: inner });
    expect(formatErrorChain(outer)).toBe("outer: inner");
  });

  it("stringifies a non-Error cause", () => {
    const error = new Error("wrapper", { cause: "raw string cause" });
    expect(formatErrorChain(error)).toBe("wrapper: raw string cause");
  });

  it("returns String(value) for a non-Error top-level value", () => {
    expect(formatErrorChain("a string error")).toBe("a string error");
    expect(formatErrorChain(42)).toBe("42");
  });

  it("does not loop infinitely on a circular cause chain (ERR-2)", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    // Create a cycle: a.cause = b
    Object.defineProperty(a, "cause", { value: b, writable: true });

    expect(() => formatErrorChain(a)).not.toThrow();
    const result = formatErrorChain(a);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  it("handles a three-level chain", () => {
    const root = new Error("root");
    const mid = new Error("mid", { cause: root });
    const top = new Error("top", { cause: mid });
    expect(formatErrorChain(top)).toBe("top: mid: root");
  });
});
