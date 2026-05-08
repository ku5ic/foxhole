import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi } from "vitest";

import {
  mapLighthouseAuditToFinding,
  extractMetrics,
  type LighthouseAudit,
} from "../../src/runner/lighthouse.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

interface RawFixture {
  audits: Record<string, LighthouseAudit>;
  categories: Record<string, { score: number | null }>;
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
    displayValue: "Potential savings of 560 ms",
    ...overrides,
  };
}

describe("mapLighthouseAuditToFinding - catalog hit", () => {
  it("produces a Finding for a catalogued audit with score 0.4 (critical from catalog)", () => {
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

  it("maps null score to critical when rule is not catalogued", () => {
    const finding = mapLighthouseAuditToFinding(
      makeAudit({ id: "unknown-audit", score: null }),
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
      { performance: { score: 0.714 }, accessibility: { score: 0.876 } },
    );
    expect(metrics.performance_score).toBe(71);
    expect(metrics.accessibility_score).toBe(88);
  });
});

describe("fixture round-trip", () => {
  it("maps all failing audits in lighthouse-raw.json without throwing", () => {
    const { audits } = loadFixture();
    expect(() => {
      for (const audit of Object.values(audits)) mapLighthouseAuditToFinding(audit, PAGE_URL);
    }).not.toThrow();
  });

  it("produces well-formed findings from the fixture", () => {
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

  it("does not produce findings for passing audits (score >= 0.9)", () => {
    const { audits } = loadFixture();
    const passingAudits = Object.values(audits).filter((a) => a.score !== null && a.score >= 0.9);
    for (const audit of passingAudits) {
      expect(mapLighthouseAuditToFinding(audit, PAGE_URL)).toBeNull();
    }
  });
});
