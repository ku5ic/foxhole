import { describe, it, expect } from "vitest";

import {
  buildBundleFindings,
  hasPathExtension,
  sanitizeResourceUrl,
  type ResourceInfo,
} from "../../src/runner/bundle.js";

const PAGE_URL = "https://example.com";

const KB = 1024;
const MB = 1024 * KB;

function jsResource(url: string, sizeBytes: number): ResourceInfo {
  return { url, size: sizeBytes };
}

function cssResource(url: string, sizeBytes: number): ResourceInfo {
  return { url, size: sizeBytes };
}

describe("total-js-size rule", () => {
  it("produces no finding when total JS is under 500 KB", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", 400 * KB)],
      [],
      [],
      PAGE_URL,
    );
    expect(findings.filter((f) => f.rule_id === "bundle/total-js-size")).toHaveLength(0);
  });

  it("produces a finding when total JS exceeds 500 KB", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", 501 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match).toBeDefined();
    expect(match?.severity).toBe("major");
    expect(match?.category).toBe("bundle");
  });

  it("uses catalog title", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", 501 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match?.title).toBe("Total JavaScript transfer size exceeds 500 KB");
  });

  it("sums multiple JS resources for the threshold check", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/a.js", 300 * KB),
        jsResource("https://example.com/b.js", 250 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    expect(findings.filter((f) => f.rule_id === "bundle/total-js-size")).toHaveLength(1);
  });

  it("produces a stable ID across two calls with the same inputs", () => {
    const resources = [jsResource("https://example.com/a.js", 600 * KB)];
    const a = buildBundleFindings(resources, [], [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/total-js-size",
    );
    const b = buildBundleFindings(resources, [], [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/total-js-size",
    );
    expect(a?.id).toBe(b?.id);
    expect(a?.id).toHaveLength(16);
    expect(a?.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces the same ID even when the measured total changes between runs", () => {
    const run1 = buildBundleFindings(
      [jsResource("https://example.com/a.js", 600 * KB)],
      [],
      [],
      PAGE_URL,
    ).find((f) => f.rule_id === "bundle/total-js-size");
    const run2 = buildBundleFindings(
      [jsResource("https://example.com/a.js", 700 * KB)],
      [],
      [],
      PAGE_URL,
    ).find((f) => f.rule_id === "bundle/total-js-size");
    expect(run1?.id).toBe(run2?.id);
  });
});

describe("large-javascript-chunk rule", () => {
  it("produces no finding when every JS resource is under 200 KB", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", 150 * KB)],
      [],
      [],
      PAGE_URL,
    );
    expect(findings.filter((f) => f.rule_id === "bundle/large-javascript-chunk")).toHaveLength(0);
  });

  it("produces one finding per oversized JS resource", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/a.js", 250 * KB),
        jsResource("https://example.com/b.js", 300 * KB),
        jsResource("https://example.com/small.js", 100 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    const chunks = findings.filter((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(chunks).toHaveLength(2);
  });

  it("uses catalog title", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.title).toBe("Single JavaScript resource exceeds 200 KB");
  });

  it("sanitizes the resource URL in the description", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/assets/main.js?v=abc123", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.description).not.toContain("?v=abc123");
    expect(match?.description).toContain("/assets/main.js");
  });

  it("produces distinct IDs for distinct resource URLs", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/a.js", 250 * KB),
        jsResource("https://example.com/b.js", 250 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    const chunks = findings.filter((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(chunks[0]?.id).not.toBe(chunks[1]?.id);
  });

  it("produces a stable ID across two calls", () => {
    const resources = [jsResource("https://example.com/main.js", 250 * KB)];
    const a = buildBundleFindings(resources, [], [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/large-javascript-chunk",
    );
    const b = buildBundleFindings(resources, [], [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/large-javascript-chunk",
    );
    expect(a?.id).toBe(b?.id);
  });
});

describe("total-css-size rule", () => {
  it("produces no finding when total CSS is under 100 KB", () => {
    const findings = buildBundleFindings(
      [],
      [cssResource("https://example.com/a.css", 80 * KB)],
      [],
      PAGE_URL,
    );
    expect(findings.filter((f) => f.rule_id === "bundle/total-css-size")).toHaveLength(0);
  });

  it("produces a finding when total CSS exceeds 100 KB", () => {
    const findings = buildBundleFindings(
      [],
      [cssResource("https://example.com/a.css", 101 * KB)],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-css-size");
    expect(match).toBeDefined();
    expect(match?.severity).toBe("minor");
  });

  it("uses catalog title", () => {
    const findings = buildBundleFindings(
      [],
      [cssResource("https://example.com/a.css", 101 * KB)],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-css-size");
    expect(match?.title).toBe("Total CSS transfer size exceeds 100 KB");
  });

  it("produces a stable ID across two calls", () => {
    const resources = [cssResource("https://example.com/a.css", 150 * KB)];
    const a = buildBundleFindings([], resources, [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/total-css-size",
    );
    const b = buildBundleFindings([], resources, [], PAGE_URL).find(
      (f) => f.rule_id === "bundle/total-css-size",
    );
    expect(a?.id).toBe(b?.id);
  });

  it("produces the same ID even when the measured total changes between runs", () => {
    const run1 = buildBundleFindings(
      [],
      [cssResource("https://example.com/a.css", 150 * KB)],
      [],
      PAGE_URL,
    ).find((f) => f.rule_id === "bundle/total-css-size");
    const run2 = buildBundleFindings(
      [],
      [cssResource("https://example.com/a.css", 200 * KB)],
      [],
      PAGE_URL,
    ).find((f) => f.rule_id === "bundle/total-css-size");
    expect(run1?.id).toBe(run2?.id);
  });
});

describe("insecure-resource rule", () => {
  it("produces no finding for HTTPS resources", () => {
    const findings = buildBundleFindings([], [], [], PAGE_URL);
    expect(findings.filter((f) => f.rule_id === "bundle/insecure-resource")).toHaveLength(0);
  });

  it("produces a finding for each HTTP resource", () => {
    const findings = buildBundleFindings(
      [],
      [],
      ["http://cdn.example.com/script.js", "http://cdn.example.com/style.css"],
      PAGE_URL,
    );
    expect(findings.filter((f) => f.rule_id === "bundle/insecure-resource")).toHaveLength(2);
  });

  it("uses catalog title and critical severity", () => {
    const findings = buildBundleFindings([], [], ["http://cdn.example.com/script.js"], PAGE_URL);
    const match = findings.find((f) => f.rule_id === "bundle/insecure-resource");
    expect(match?.title).toBe("Resource loaded over insecure HTTP");
    expect(match?.severity).toBe("critical");
  });

  it("sanitizes the resource URL in the description", () => {
    const findings = buildBundleFindings(
      [],
      [],
      ["http://cdn.example.com/script.js?token=secret"],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/insecure-resource");
    expect(match?.description).not.toContain("token=secret");
    expect(match?.description).toContain("/script.js");
  });

  it("produces a stable ID across two calls", () => {
    const httpResources = ["http://cdn.example.com/script.js"];
    const a = buildBundleFindings([], [], httpResources, PAGE_URL).find(
      (f) => f.rule_id === "bundle/insecure-resource",
    );
    const b = buildBundleFindings([], [], httpResources, PAGE_URL).find(
      (f) => f.rule_id === "bundle/insecure-resource",
    );
    expect(a?.id).toBe(b?.id);
    expect(a?.id).toHaveLength(16);
    expect(a?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("sanitizeResourceUrl", () => {
  it("strips query string", () => {
    expect(sanitizeResourceUrl("https://example.com/a.js?v=123")).toBe("/a.js");
  });

  it("strips fragment", () => {
    expect(sanitizeResourceUrl("https://example.com/a.js#section")).toBe("/a.js");
  });

  it("strips origin, keeping only the path", () => {
    expect(sanitizeResourceUrl("https://cdn.example.com/assets/main.js")).toBe("/assets/main.js");
  });

  it("truncates paths over 200 characters", () => {
    const longPath = "/assets/" + "a".repeat(300) + ".js";
    const result = sanitizeResourceUrl(`https://example.com${longPath}`);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("handles non-parseable URLs without throwing", () => {
    expect(() => sanitizeResourceUrl("not-a-url")).not.toThrow();
  });
});

describe("hasPathExtension (BUN-2)", () => {
  it("detects .js extension in a clean URL", () => {
    expect(hasPathExtension("https://example.com/main.js", ".js")).toBe(true);
  });

  it("ignores .js in query string -- uses pathname only", () => {
    expect(hasPathExtension("https://example.com/loader?bundle=main.js", ".js")).toBe(false);
  });

  it("detects .css extension in a URL with query params", () => {
    expect(hasPathExtension("https://example.com/style.css?v=1234", ".css")).toBe(true);
  });

  it("returns false for a non-matching extension", () => {
    expect(hasPathExtension("https://example.com/image.png", ".js")).toBe(false);
  });

  it("handles non-parseable URLs without throwing", () => {
    expect(() => hasPathExtension("not-a-url.js", ".js")).not.toThrow();
  });
});

describe("all four rules produce well-formed findings", () => {
  it("every finding has a 16-char hex id, bundle category, null source, and null wcag", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/a.js", MB),
        jsResource("https://example.com/b.js", 250 * KB),
      ],
      [cssResource("https://example.com/a.css", 150 * KB)],
      ["http://cdn.example.com/x.js"],
      PAGE_URL,
    );
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.id).toHaveLength(16);
      expect(f.id).toMatch(/^[0-9a-f]{16}$/);
      expect(f.category).toBe("bundle");
      expect(f.source).toBeNull();
      expect(f.wcag).toBeNull();
      expect(f.impact).toBeNull();
    }
  });
});
