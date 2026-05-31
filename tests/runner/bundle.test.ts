import { describe, it, expect } from "vitest";

import {
  buildBundleFindings,
  classifyResource,
  filterNomoduleResources,
  hasPathExtension,
  measureResourceSize,
  sanitizeResourceUrl,
  type ResourceInfo,
} from "../../src/runner/bundle.js";

const PAGE_URL = "https://example.com";

const KB = 1024;
const MB = 1024 * KB;

function makeResponse(
  headerMap: Record<string, string>,
  bodyBytes: number,
): { headers: () => Record<string, string>; body: () => Promise<Buffer> } {
  return {
    headers: (): Record<string, string> => headerMap,
    body: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(bodyBytes)),
  };
}

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

  it("includes framework/app byte breakdown in description when framework bytes are present", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/_next/static/chunks/framework-abc.js", 400 * KB),
        jsResource("https://example.com/assets/app-abc.js", 200 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match?.description).toContain("framework");
    expect(match?.description).toContain("application");
  });

  it("omits the breakdown when no framework bytes are present", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/assets/a.js", 300 * KB),
        jsResource("https://example.com/assets/b.js", 250 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match?.description).not.toContain("framework");
  });

  it("carries kind: null regardless of resource mix", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/_next/static/chunks/framework-abc.js", 600 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match?.kind).toBeNull();
  });

  it("shows exact KB values in the framework/app breakdown", () => {
    const findings = buildBundleFindings(
      [
        jsResource("https://example.com/_next/static/chunks/framework-abc.js", 400 * KB),
        jsResource("https://example.com/assets/app-abc.js", 200 * KB),
      ],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/total-js-size");
    expect(match?.description).toContain("400.0 KB framework");
    expect(match?.description).toContain("200.0 KB application");
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

  it("sets kind to framework for a Next.js framework chunk", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/_next/static/chunks/framework-abc123.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.kind).toBe("framework");
  });

  it("uses the framework recommendation for a framework chunk", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/_next/static/chunks/framework-abc123.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.recommendation).toContain("framework chunk");
  });

  it("sets kind to application for a non-framework chunk", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/assets/app-abc123.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.kind).toBe("application");
  });

  it("uses the standard recommendation for an application chunk", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/assets/app-abc123.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const match = findings.find((f) => f.rule_id === "bundle/large-javascript-chunk");
    expect(match?.recommendation).not.toContain("framework chunk");
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

describe("classifyResource", () => {
  it("classifies a Next.js framework chunk as framework", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/framework-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Next.js main entry as framework", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/main-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Next.js app shell as framework", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/pages/_app-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Next.js webpack runtime as framework", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/webpack-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a CRA runtime-main chunk as framework", () => {
    expect(classifyResource("https://example.com/static/js/runtime-main.abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Vite pre-bundled dep as framework", () => {
    expect(classifyResource("https://example.com/node_modules/.vite/deps/react-dom.js")).toBe(
      "framework",
    );
  });

  it("classifies a Vite vendor split chunk as framework", () => {
    expect(classifyResource("https://example.com/assets/vendor-abc123.js")).toBe("framework");
  });

  it("classifies a Next.js externalized React chunk as framework", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/react-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Nuxt 3 runtime entry as framework", () => {
    expect(classifyResource("https://example.com/_nuxt/entry.abc123.js")).toBe("framework");
  });

  it("classifies Nuxt 3 build metadata as framework", () => {
    expect(classifyResource("https://example.com/_nuxt/builds/meta.abc123.js")).toBe("framework");
  });

  it("classifies a SvelteKit framework boot file as framework", () => {
    expect(classifyResource("https://example.com/_app/immutable/entry/start.abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a SvelteKit Vite runtime shim as framework", () => {
    expect(classifyResource("https://example.com/_app/immutable/start-abc123.js")).toBe(
      "framework",
    );
  });

  it("classifies a Gatsby / webpack runtime chunk as framework", () => {
    expect(classifyResource("https://example.com/webpack-runtime-abc123.js")).toBe("framework");
  });

  it("classifies a Remix client entry as framework", () => {
    expect(classifyResource("https://example.com/build/entry.client-abc123.js")).toBe("framework");
  });

  it("does not classify a SvelteKit page node as framework", () => {
    expect(classifyResource("https://example.com/_app/immutable/nodes/0.abc123.js")).toBe(
      "application",
    );
  });

  it("classifies an application chunk as application", () => {
    expect(classifyResource("https://example.com/_next/static/chunks/pages/index-abc.js")).toBe(
      "application",
    );
  });

  it("classifies a generic app bundle as application", () => {
    expect(classifyResource("https://example.com/assets/main.abc123.js")).toBe("application");
  });

  it("uses the path only -- query strings do not affect classification", () => {
    expect(
      classifyResource("https://example.com/_next/static/chunks/framework-abc123.js?v=1"),
    ).toBe("framework");
  });
});

describe("filterNomoduleResources", () => {
  it("returns the original array unchanged when nomoduleUrls is empty", () => {
    const resources = [
      jsResource("https://example.com/a.js", 300 * KB),
      jsResource("https://example.com/b.js", 200 * KB),
    ];
    expect(filterNomoduleResources(resources, new Set())).toBe(resources);
  });

  it("removes a resource whose URL is in the nomodule set", () => {
    const resources = [
      jsResource("https://example.com/main.js", 400 * KB),
      jsResource("https://example.com/polyfills-abc123.js", 110 * KB),
    ];
    const result = filterNomoduleResources(
      resources,
      new Set(["https://example.com/polyfills-abc123.js"]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe("https://example.com/main.js");
  });

  it("removes all resources when every URL is in the nomodule set", () => {
    const resources = [jsResource("https://example.com/polyfills-abc123.js", 110 * KB)];
    const result = filterNomoduleResources(
      resources,
      new Set(["https://example.com/polyfills-abc123.js"]),
    );
    expect(result).toHaveLength(0);
  });

  it("keeps resources whose URLs are not in the nomodule set", () => {
    const resources = [
      jsResource("https://example.com/chunk-a.js", 300 * KB),
      jsResource("https://example.com/chunk-b.js", 250 * KB),
    ];
    const result = filterNomoduleResources(
      resources,
      new Set(["https://example.com/polyfills-abc123.js"]),
    );
    expect(result).toHaveLength(2);
  });

  it("a nomodule polyfill does not push total JS over the threshold after filtering", () => {
    const resources = [
      jsResource("https://example.com/framework.js", 420 * KB),
      jsResource("https://example.com/polyfills-abc123.js", 110 * KB),
    ];
    const nomodule = new Set(["https://example.com/polyfills-abc123.js"]);
    const filtered = filterNomoduleResources(resources, nomodule);
    const findings = buildBundleFindings(filtered, [], [], PAGE_URL);
    expect(findings.filter((f) => f.rule_id === "bundle/total-js-size")).toHaveLength(0);
  });

  it("a nomodule polyfill is also excluded from the large-chunk check", () => {
    const resources = [jsResource("https://example.com/polyfills-abc123.js", 210 * KB)];
    const nomodule = new Set(["https://example.com/polyfills-abc123.js"]);
    const filtered = filterNomoduleResources(resources, nomodule);
    const findings = buildBundleFindings(filtered, [], [], PAGE_URL);
    expect(findings.filter((f) => f.rule_id === "bundle/large-javascript-chunk")).toHaveLength(0);
  });
});

describe("measureResourceSize", () => {
  it("returns Content-Length value for an uncompressed response (no encoding header)", async () => {
    const response = makeResponse({ "content-length": "123456" }, 0);
    expect(await measureResourceSize(response as never)).toBe(123_456);
  });

  it("falls back to body length when Content-Length is absent", async () => {
    const response = makeResponse({}, 200 * 1024);
    expect(await measureResourceSize(response as never)).toBe(200 * 1024);
  });

  it("ignores Content-Length when content-encoding is present (compressed response)", async () => {
    // Transfer size is 150 KB, decoded body is 600 KB -- the decoded size must win.
    const response = makeResponse(
      { "content-encoding": "gzip", "content-length": String(150 * 1024) },
      600 * 1024,
    );
    expect(await measureResourceSize(response as never)).toBe(600 * 1024);
  });

  it("caps the body at MAX_BODY_BUFFER_BYTES (10 MB) when Content-Length is absent", async () => {
    const oversized = 15 * 1024 * 1024;
    const response = makeResponse({}, oversized);
    expect(await measureResourceSize(response as never)).toBe(10 * 1024 * 1024);
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

  it("total-js-size, total-css-size, and insecure-resource carry kind: null", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/a.js", MB)],
      [cssResource("https://example.com/a.css", 150 * KB)],
      ["http://cdn.example.com/x.js"],
      PAGE_URL,
    );
    const nullKindRules = [
      "bundle/total-js-size",
      "bundle/total-css-size",
      "bundle/insecure-resource",
    ];
    for (const ruleId of nullKindRules) {
      const f = findings.find((x) => x.rule_id === ruleId);
      expect(f, `${ruleId} finding should exist`).toBeDefined();
      expect(f?.kind, `${ruleId} kind should be null`).toBeNull();
    }
  });

  it("large-javascript-chunk on an app URL carries kind: application", () => {
    const findings = buildBundleFindings(
      [jsResource("https://example.com/assets/app.js", 250 * KB)],
      [],
      [],
      PAGE_URL,
    );
    const f = findings.find((x) => x.rule_id === "bundle/large-javascript-chunk");
    expect(f?.kind).toBe("application");
  });
});
