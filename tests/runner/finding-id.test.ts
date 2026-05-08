import { describe, it, expect } from "vitest";

import {
  computeFindingId,
  buildSemanticPath,
  buildTextFingerprint,
} from "../../src/runner/finding-id.js";

const BASE_INPUT = {
  pageUrl: "https://example.com/page",
  ruleId: "a11y/image-alt",
  semanticPath: "img",
  textFingerprint: "image-alt: img.hero-banner",
};

describe("computeFindingId", () => {
  it("produces exactly 16 hex characters", () => {
    const id = computeFindingId(BASE_INPUT);
    expect(id).toHaveLength(16);
  });

  it("output is lowercase hex", () => {
    const id = computeFindingId(BASE_INPUT);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("same inputs produce the same output across multiple calls (stability)", () => {
    const first = computeFindingId(BASE_INPUT);
    const second = computeFindingId(BASE_INPUT);
    const third = computeFindingId({ ...BASE_INPUT });
    expect(first).toBe(second);
    expect(first).toBe(third);
  });

  it("different rule IDs produce different IDs", () => {
    const a = computeFindingId({ ...BASE_INPUT, ruleId: "a11y/image-alt" });
    const b = computeFindingId({ ...BASE_INPUT, ruleId: "a11y/label" });
    expect(a).not.toBe(b);
  });

  it("different page URLs produce different IDs", () => {
    const a = computeFindingId({ ...BASE_INPUT, pageUrl: "https://example.com/page" });
    const b = computeFindingId({ ...BASE_INPUT, pageUrl: "https://example.com/other" });
    expect(a).not.toBe(b);
  });

  it("different semantic paths produce different IDs", () => {
    const a = computeFindingId({ ...BASE_INPUT, semanticPath: "img" });
    const b = computeFindingId({ ...BASE_INPUT, semanticPath: "img#hero" });
    expect(a).not.toBe(b);
  });

  it("different text fingerprints produce different IDs", () => {
    const a = computeFindingId({ ...BASE_INPUT, textFingerprint: "image-alt: img.hero-banner" });
    const b = computeFindingId({ ...BASE_INPUT, textFingerprint: "image-alt: img.logo" });
    expect(a).not.toBe(b);
  });

  it("whitespace differences in text fingerprint produce different IDs (no normalization)", () => {
    const a = computeFindingId({ ...BASE_INPUT, textFingerprint: "image-alt: img" });
    const b = computeFindingId({ ...BASE_INPUT, textFingerprint: "image-alt:  img" });
    expect(a).not.toBe(b);
  });

  it("empty semanticPath is handled without error", () => {
    const id = computeFindingId({ ...BASE_INPUT, semanticPath: "" });
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("buildSemanticPath", () => {
  it("extracts tag name from simple outerHTML", () => {
    expect(buildSemanticPath("<img src='hero.png'>")).toBe("img");
  });

  it("includes id when present", () => {
    expect(buildSemanticPath('<input id="email" type="email">')).toBe("input#email");
  });

  it("includes aria-label when id is absent", () => {
    expect(buildSemanticPath('<button aria-label="Close dialog">X</button>')).toBe(
      "button:Close dialog",
    );
  });

  it("includes role when id and aria-label are absent", () => {
    expect(buildSemanticPath('<div role="button" class="btn">Click</div>')).toBe(
      "div[role=button]",
    );
  });

  it("falls back to tag name when no identifying attributes", () => {
    expect(buildSemanticPath("<select><option>A</option></select>")).toBe("select");
  });

  it("is case-insensitive on tag name", () => {
    expect(buildSemanticPath("<IMG src='x.png'>")).toBe("img");
  });

  it("handles empty string without throwing", () => {
    const result = buildSemanticPath("");
    expect(typeof result).toBe("string");
  });
});

describe("buildTextFingerprint", () => {
  it("concatenates ruleId and detail with colon separator", () => {
    const result = buildTextFingerprint({ ruleId: "a11y/label", detail: "input has no label" });
    expect(result).toBe("a11y/label: input has no label");
  });

  it("truncates to 64 characters", () => {
    const long = "x".repeat(100);
    const result = buildTextFingerprint({ ruleId: "a11y/label", detail: long });
    expect(result).toHaveLength(64);
  });

  it("does not truncate strings under 64 characters", () => {
    const result = buildTextFingerprint({ ruleId: "a11y/label", detail: "short" });
    expect(result.length).toBeLessThan(64);
    expect(result).toBe("a11y/label: short");
  });

  it("preserves internal whitespace without normalization", () => {
    const a = buildTextFingerprint({ ruleId: "a11y/label", detail: "two  spaces" });
    const b = buildTextFingerprint({ ruleId: "a11y/label", detail: "two spaces" });
    expect(a).not.toBe(b);
  });
});
