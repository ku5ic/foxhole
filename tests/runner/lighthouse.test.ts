import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi } from "vitest";

import {
  mapLighthouseAuditToFinding,
  parseLighthouseResults,
  extractMetrics,
  buildAuditCategoryMap,
  buildLighthouseConfig,
  type LighthouseAudit,
  type LighthouseCategory,
} from "../../src/runner/lighthouse.js";
import { RunnerError } from "../../src/errors.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

interface RawFixture {
  audits: Record<string, LighthouseAudit>;
  categories: Record<string, LighthouseCategory>;
}

function loadFixture(): RawFixture {
  const raw = readFileSync(path.resolve(__dirname, "../fixtures/lighthouse-raw.json"), "utf8");
  return JSON.parse(raw) as RawFixture;
}

const PAGE_URL = "https://example.com";

function makeAudit(overrides: Partial<LighthouseAudit> = {}): LighthouseAudit {
  return {
    id: "render-blocking-resources",
    title: "Eliminate render-blocking resources",
    description: "Resources are blocking the first paint of your page.",
    score: 0.4,
    scoreDisplayMode: "numeric",
    displayValue: "Potential savings of 560 ms",
    ...overrides,
  };
}

describe("mapLighthouseAuditToFinding - catalog hit", () => {
  it("produces a Finding for a catalogued audit with score 0.4 (major from catalog)", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "render-blocking-resources", score: 0.4 }),
      PAGE_URL,
    );
    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe("major");
    expect(finding?.category).toBe("perf");
  });

  it("uses catalog recommendation for a catalogued audit", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "render-blocking-resources" }),
      PAGE_URL,
    );
    expect(finding?.recommendation).not.toContain("Lighthouse documentation");
  });

  it("produces a Finding for a catalogued audit with score 0.85", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "render-blocking-resources", score: 0.85 }),
      PAGE_URL,
    );
    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe("major");
  });

  it("uses catalog effort for a catalogued audit", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "render-blocking-resources" }),
      PAGE_URL,
    );
    expect(finding?.effort).toBe("medium");
  });
});

describe("mapLighthouseAuditToFinding - scoreDisplayMode filtering", () => {
  it("returns null for notApplicable regardless of score", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ score: null, scoreDisplayMode: "notApplicable" }),
      PAGE_URL,
    );
    expect(finding).toBeNull();
  });

  it("returns null for informative regardless of score", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ score: null, scoreDisplayMode: "informative" }),
      PAGE_URL,
    );
    expect(finding).toBeNull();
  });

  it("returns null for manual regardless of score", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ score: null, scoreDisplayMode: "manual" }),
      PAGE_URL,
    );
    expect(finding).toBeNull();
  });

  it("returns null for metricSavings regardless of score", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ score: null, scoreDisplayMode: "metricSavings" }),
      PAGE_URL,
    );
    expect(finding).toBeNull();
  });

  it("returns null when scoreDisplayMode is absent", () => {
    const audit: LighthouseAudit = {
      id: "render-blocking-resources",
      title: "Eliminate render-blocking resources",
      description: "Resources are blocking the first paint of your page.",
      score: 0.3,
      displayValue: "Potential savings of 560 ms",
    };
    const finding = mapLighthouseAuditToFinding(audit, PAGE_URL);
    expect(finding).toBeNull();
  });

  it("produces a finding for numeric with score below 0.9", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ scoreDisplayMode: "numeric", score: 0.4 }),
      PAGE_URL,
    );
    expect(finding).not.toBeNull();
  });

  it("produces a finding for binary with score 0 (failing)", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-binary-audit", scoreDisplayMode: "binary", score: 0 }),
      PAGE_URL,
    );
    expect(finding).not.toBeNull();
  });
});

describe("mapLighthouseAuditToFinding - passing audits", () => {
  it("returns null for score >= 0.9 (passing)", () => {
    const finding = mapLighthouseAuditToFinding(makeAudit({ score: 0.95 }), PAGE_URL);
    expect(finding).toBeNull();
  });

  it("returns null for score exactly 0.9", () => {
    const finding = mapLighthouseAuditToFinding(makeAudit({ score: 0.9 }), PAGE_URL);
    expect(finding).toBeNull();
  });
});

describe("mapLighthouseAuditToFinding - catalog miss fallback", () => {
  it("maps score < 0.5 to critical when rule is not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", score: 0.4 }),
      PAGE_URL,
    );
    expect(finding?.severity).toBe("critical");
  });

  it("maps score 0.5-0.89 to major when rule is not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", score: 0.7 }),
      PAGE_URL,
    );
    expect(finding?.severity).toBe("major");
  });

  it("maps null score to critical for binary audits when rule is not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", score: null, scoreDisplayMode: "binary" }),
      PAGE_URL,
    );
    expect(finding?.severity).toBe("critical");
  });

  it("uses generic recommendation referencing audit id when not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", score: 0.4 }),
      PAGE_URL,
    );
    expect(finding?.recommendation).toContain("Lighthouse documentation");
    expect(finding?.recommendation).toContain("unknown-audit");
  });

  it("uses audit.title as title when not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", title: "Custom audit title", score: 0.4 }),
      PAGE_URL,
    );
    expect(finding?.title).toBe("Custom audit title");
  });

  it("emits debug warning to stderr when FOXHOLE_DEBUG=1", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    process.env.FOXHOLE_DEBUG = "1";

    mapLighthouseAuditToFinding(makeAudit({ id: "unknown-audit", score: 0.4 }), PAGE_URL);

    expect(stderr).toHaveBeenCalledWith("[foxhole:debug] catalog gap: ruleId=perf/unknown-audit\n");

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });
});

describe("mapLighthouseAuditToFinding - ID stability", () => {
  it("produces the same ID across two calls for the same audit on the same page", () => {
    const audit = makeAudit({ id: "render-blocking-resources", score: 0.4 });
    const a = mapLighthouseAuditToFinding(audit, PAGE_URL);
    const b = mapLighthouseAuditToFinding(audit, PAGE_URL);
    expect(a?.id).toBe(b?.id);
  });

  it("produces the same ID for a numeric audit even when displayValue changes between runs", () => {
    const base = makeAudit({ scoreDisplayMode: "numeric", score: 0.4 });
    const runA = mapLighthouseAuditToFinding(
      { ...base, displayValue: "Potential savings of 480 ms" },
      PAGE_URL,
    );
    const runB = mapLighthouseAuditToFinding(
      { ...base, displayValue: "Potential savings of 560 ms" },
      PAGE_URL,
    );
    expect(runA?.id).toBe(runB?.id);
  });

  it("produces different IDs for the same audit on different pages", () => {
    const audit = makeAudit({ id: "render-blocking-resources", score: 0.4 });
    const a = mapLighthouseAuditToFinding(audit, "https://example.com/a");
    const b = mapLighthouseAuditToFinding(audit, "https://example.com/b");
    expect(a?.id).not.toBe(b?.id);
  });

  it("produces 16-character hex IDs", () => {
    const finding = mapLighthouseAuditToFinding(makeAudit({ score: 0.4 }), PAGE_URL);
    expect(finding?.id).toHaveLength(16);
    expect(finding?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("buildAuditCategoryMap", () => {
  it("maps performance audit ids to the performance category", () => {
    const categories: Record<string, LighthouseCategory> = {
      performance: {
        score: 0.71,
        auditRefs: [{ id: "render-blocking-resources" }, { id: "unused-javascript" }],
      },
      accessibility: {
        score: 1,
        auditRefs: [{ id: "aria-allowed-attr" }, { id: "frame-title" }],
      },
    };
    const map = buildAuditCategoryMap(categories);
    expect(map.get("render-blocking-resources")).toBe("performance");
    expect(map.get("unused-javascript")).toBe("performance");
  });

  it("maps accessibility audit ids to the accessibility category", () => {
    const categories: Record<string, LighthouseCategory> = {
      performance: { score: 0.9, auditRefs: [{ id: "render-blocking-resources" }] },
      accessibility: {
        score: 0.8,
        auditRefs: [{ id: "aria-allowed-attr" }, { id: "frame-title" }],
      },
    };
    const map = buildAuditCategoryMap(categories);
    expect(map.get("aria-allowed-attr")).toBe("accessibility");
    expect(map.get("frame-title")).toBe("accessibility");
  });

  it("accessibility audits do not map to performance (the category runLighthouse emits findings for)", () => {
    const categories: Record<string, LighthouseCategory> = {
      performance: { score: 0.9, auditRefs: [{ id: "render-blocking-resources" }] },
      accessibility: { score: 0.8, auditRefs: [{ id: "aria-allowed-attr" }] },
    };
    const map = buildAuditCategoryMap(categories);
    expect(map.get("aria-allowed-attr")).not.toBe("performance");
  });

  it("returns an empty map when categories is empty", () => {
    const map = buildAuditCategoryMap({});
    expect(map.size).toBe(0);
  });

  it("handles categories with empty auditRefs arrays", () => {
    const categories: Record<string, LighthouseCategory> = {
      performance: { score: null, auditRefs: [] },
    };
    const map = buildAuditCategoryMap(categories);
    expect(map.size).toBe(0);
  });
});

describe("extractMetrics", () => {
  it("extracts all metrics from fixture audits and categories", () => {
    const { audits, categories } = loadFixture();
    const metrics = extractMetrics(audits, categories);

    expect(metrics.lcp).toBe(3800);
    expect(metrics.fcp).toBe(1800);
    expect(metrics.cls).toBeCloseTo(0.12);
    expect(metrics.ttfb).toBe(180);
    expect(metrics.tbt).toBe(280);
    expect(metrics.fid).toBe(110);
    expect(metrics.performance_score).toBe(71);
    expect(metrics.accessibility_score).toBe(87);
    expect(metrics.bundle_size).toBeNull();
  });

  it("returns nulls for missing audit fields", () => {
    const metrics = extractMetrics({}, {});
    expect(metrics.lcp).toBeNull();
    expect(metrics.fcp).toBeNull();
    expect(metrics.cls).toBeNull();
    expect(metrics.performance_score).toBeNull();
    expect(metrics.accessibility_score).toBeNull();
    expect(metrics.bundle_size).toBeNull();
  });

  it("rounds performance_score and accessibility_score to integers", () => {
    const metrics = extractMetrics(
      {},
      {
        performance: { score: 0.714, auditRefs: [] },
        accessibility: { score: 0.876, auditRefs: [] },
      },
    );
    expect(metrics.performance_score).toBe(71);
    expect(metrics.accessibility_score).toBe(88);
  });
});

describe("fixture round-trip", () => {
  it("maps all audits in lighthouse-raw.json without throwing", () => {
    const { audits } = loadFixture();
    expect(() => {
      for (const audit of Object.values(audits)) mapLighthouseAuditToFinding(audit, PAGE_URL);
    }).not.toThrow();
  });

  it("produces well-formed findings only from numeric/binary performance audits below 0.9", () => {
    const { audits } = loadFixture();
    const findings = Object.values(audits)
      .map((a) => mapLighthouseAuditToFinding(a, PAGE_URL))
      .filter((f): f is NonNullable<typeof f> => f !== null);

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(finding.id).toHaveLength(16);
      expect(finding.category).toBe("perf");
      expect(finding.rule_id).toMatch(/^perf\//);
      expect(finding.source).toBeNull();
      expect(finding.wcag).toBeNull();
    }
  });

  it("does not produce findings for notApplicable or informative audits in the fixture", () => {
    const { audits } = loadFixture();
    const nonScoredAudits = Object.values(audits).filter(
      (a) => a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "informative",
    );
    expect(nonScoredAudits.length).toBeGreaterThan(0);
    for (const audit of nonScoredAudits) {
      expect(mapLighthouseAuditToFinding(audit, PAGE_URL)).toBeNull();
    }
  });

  it("does not produce findings for passing audits (score >= 0.9)", () => {
    const { audits } = loadFixture();
    const passingAudits = Object.values(audits).filter(
      (a) =>
        (a.scoreDisplayMode === "binary" || a.scoreDisplayMode === "numeric") &&
        a.score !== null &&
        a.score >= 0.9,
    );
    expect(passingAudits.length).toBeGreaterThan(0);
    for (const audit of passingAudits) {
      expect(mapLighthouseAuditToFinding(audit, PAGE_URL)).toBeNull();
    }
  });

  it("accessibility audits in the fixture do not map to performance via buildAuditCategoryMap", () => {
    const { categories } = loadFixture();
    const map = buildAuditCategoryMap(categories);
    expect(map.get("aria-allowed-attr")).toBe("accessibility");
    expect(map.get("document-title")).toBe("accessibility");
    expect(map.get("render-blocking-resources")).toBe("performance");
  });
});

describe("buildLighthouseConfig", () => {
  it("desktop preset uses simulate throttling with desktop form factor", () => {
    const config = buildLighthouseConfig("desktop");
    expect(config.formFactor).toBe("desktop");
    expect(config.throttlingMethod).toBe("simulate");
    expect(config.throttling.cpuSlowdownMultiplier).toBe(1);
    expect(config.screenEmulation.mobile).toBe(false);
  });

  it("mobile preset uses simulate throttling with mobile form factor and 4x CPU slowdown", () => {
    const config = buildLighthouseConfig("mobile");
    expect(config.formFactor).toBe("mobile");
    expect(config.throttlingMethod).toBe("simulate");
    expect(config.throttling.cpuSlowdownMultiplier).toBe(4);
    expect(config.screenEmulation.mobile).toBe(true);
  });

  it("none preset uses provided throttling with desktop form factor and no CPU slowdown", () => {
    const config = buildLighthouseConfig("none");
    expect(config.formFactor).toBe("desktop");
    expect(config.throttlingMethod).toBe("provided");
    expect(config.throttling.cpuSlowdownMultiplier).toBe(1);
    expect(config.throttling.rttMs).toBe(0);
    expect(config.screenEmulation.mobile).toBe(false);
  });

  it("desktop preset uses desktopDense4G network values (40ms RTT, 10Mbps)", () => {
    const config = buildLighthouseConfig("desktop");
    expect(config.throttling.rttMs).toBe(40);
    expect(config.throttling.throughputKbps).toBe(10_240);
  });

  it("mobile preset uses mobileSlow4G network values (150ms RTT, ~1.6Mbps)", () => {
    const config = buildLighthouseConfig("mobile");
    expect(config.throttling.rttMs).toBe(150);
    expect(config.throttling.throughputKbps).toBeCloseTo(1638.4);
  });

  it("none preset has desktop screen dimensions (1350x940)", () => {
    const config = buildLighthouseConfig("none");
    expect(config.screenEmulation.width).toBe(1350);
    expect(config.screenEmulation.height).toBe(940);
  });

  it("mobile preset has mobile screen dimensions (412x823)", () => {
    const config = buildLighthouseConfig("mobile");
    expect(config.screenEmulation.width).toBe(412);
    expect(config.screenEmulation.height).toBe(823);
  });
});

describe("parseLighthouseResults", () => {
  const validLhr = {
    audits: {
      "largest-contentful-paint": {
        id: "largest-contentful-paint",
        title: "Largest Contentful Paint",
        description: "LCP measures...",
        score: 0.5,
        scoreDisplayMode: "numeric",
        numericValue: 3200,
      },
    },
    categories: {
      performance: {
        score: 0.6,
        auditRefs: [{ id: "largest-contentful-paint" }],
      },
    },
  };

  it("accepts a valid lhr structure", () => {
    const result = parseLighthouseResults(validLhr);
    expect(result.audits["largest-contentful-paint"]).toBeDefined();
    expect(result.categories["performance"]).toBeDefined();
  });

  it("accepts empty audits and categories records", () => {
    const result = parseLighthouseResults({ audits: {}, categories: {} });
    expect(result.audits).toEqual({});
    expect(result.categories).toEqual({});
  });

  it("throws RunnerError when audits field is missing", () => {
    expect(() => parseLighthouseResults({ categories: {} })).toThrow(RunnerError);
  });

  it("throws RunnerError when categories field is missing", () => {
    expect(() => parseLighthouseResults({ audits: {} })).toThrow(RunnerError);
  });

  it("throws RunnerError when lhr is null", () => {
    expect(() => parseLighthouseResults(null)).toThrow(RunnerError);
  });

  it("throws RunnerError when an audit entry is missing title", () => {
    const bad = {
      audits: { lcp: { id: "lcp", description: "x", score: 0.5 } },
      categories: {},
    };
    expect(() => parseLighthouseResults(bad)).toThrow(RunnerError);
  });
});
