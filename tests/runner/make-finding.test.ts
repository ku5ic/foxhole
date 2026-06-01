import { describe, it, expect } from "vitest";

import { makeFinding } from "../../src/runner/make-finding.js";
import { computeFindingId } from "../../src/runner/finding-id.js";

const BASE_ARGS = {
  category: "a11y" as const,
  ruleId: "a11y/image-alt",
  pageUrl: "https://example.com/",
  title: "Images must have alt text",
  description: "Image is missing an alt attribute.",
  recommendation: "Add an alt attribute to every img element.",
  severity: "critical" as const,
  effort: "low" as const,
  textFingerprint: "image-alt: ",
};

describe("makeFinding", () => {
  it("computes id from pageUrl, ruleId, semanticPath, and textFingerprint", () => {
    const finding = makeFinding(BASE_ARGS);
    const expected = computeFindingId({
      pageUrl: BASE_ARGS.pageUrl,
      ruleId: BASE_ARGS.ruleId,
      semanticPath: "",
      textFingerprint: BASE_ARGS.textFingerprint,
    });
    expect(finding.id).toBe(expected);
  });

  it("uses provided semanticPath in ID computation", () => {
    const finding = makeFinding({ ...BASE_ARGS, semanticPath: "img#logo" });
    const expected = computeFindingId({
      pageUrl: BASE_ARGS.pageUrl,
      ruleId: BASE_ARGS.ruleId,
      semanticPath: "img#logo",
      textFingerprint: BASE_ARGS.textFingerprint,
    });
    expect(finding.id).toBe(expected);
  });

  it("defaults semanticPath to empty string in ID when omitted", () => {
    const withDefault = makeFinding(BASE_ARGS);
    const withExplicit = makeFinding({ ...BASE_ARGS, semanticPath: "" });
    expect(withDefault.id).toBe(withExplicit.id);
  });

  it("sets source to null always", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.source).toBeNull();
  });

  it("defaults selector to null when omitted", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.selector).toBeNull();
  });

  it("defaults wcag to null when omitted", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.wcag).toBeNull();
  });

  it("defaults impact to null when omitted", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.impact).toBeNull();
  });

  it("defaults kind to null when omitted", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.kind).toBeNull();
  });

  it("passes through selector string", () => {
    const finding = makeFinding({ ...BASE_ARGS, selector: "img.hero" });
    expect(finding.selector).toBe("img.hero");
  });

  it("passes through explicit null selector", () => {
    const finding = makeFinding({ ...BASE_ARGS, selector: null });
    expect(finding.selector).toBeNull();
  });

  it("passes through wcag string", () => {
    const finding = makeFinding({ ...BASE_ARGS, wcag: "1.1.1" });
    expect(finding.wcag).toBe("1.1.1");
  });

  it("passes through kind framework", () => {
    const finding = makeFinding({
      ...BASE_ARGS,
      category: "bundle",
      kind: "framework",
    });
    expect(finding.kind).toBe("framework");
  });

  it("passes through kind application", () => {
    const finding = makeFinding({
      ...BASE_ARGS,
      category: "bundle",
      kind: "application",
    });
    expect(finding.kind).toBe("application");
  });

  it("sets url to pageUrl", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.url).toBe(BASE_ARGS.pageUrl);
  });

  it("sets rule_id to ruleId", () => {
    const finding = makeFinding(BASE_ARGS);
    expect(finding.rule_id).toBe(BASE_ARGS.ruleId);
  });
});
