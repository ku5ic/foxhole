import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi } from "vitest";

import {
  mapAxeViolationToFindings,
  parseAxeViolations,
  type AxeViolation,
} from "../../src/runner/axe.js";
import { RunnerError } from "../../src/errors.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function loadFixture(): AxeViolation[] {
  const raw = readFileSync(path.resolve(__dirname, "../fixtures/axe-raw.json"), "utf8");
  return JSON.parse(raw) as AxeViolation[];
}

const PAGE_URL = "https://example.com";

function makeViolation(overrides: Partial<AxeViolation> = {}): AxeViolation {
  return {
    id: "image-alt",
    impact: "critical",
    help: "Images must have alternate text",
    description: "Ensures img elements have alternate text",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
    tags: ["wcag2a", "wcag111"],
    nodes: [{ target: ["img.hero"], html: '<img src="x.png" class="hero">' }],
    ...overrides,
  };
}

describe("mapAxeViolationToFindings - catalog hit", () => {
  it("uses catalog severity for a catalogued rule", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({ id: "image-alt", impact: "serious" }),
      PAGE_URL,
    );
    expect(finding?.severity).toBe("critical");
    expect(finding?.title).toBe("Images must have alternative text");
  });

  it("uses catalog recommendation for a catalogued rule", () => {
    const [finding] = mapAxeViolationToFindings(makeViolation({ id: "image-alt" }), PAGE_URL);
    expect(finding?.recommendation).toContain("alt");
    expect(finding?.recommendation).not.toContain("axe-core documentation");
  });

  it("uses catalog wcag for a catalogued rule", () => {
    const [finding] = mapAxeViolationToFindings(makeViolation({ id: "image-alt" }), PAGE_URL);
    expect(finding?.wcag).toBe("1.1.1");
  });

  it("uses catalog effort for a catalogued rule", () => {
    const [finding] = mapAxeViolationToFindings(makeViolation({ id: "image-alt" }), PAGE_URL);
    expect(finding?.effort).toBe("low");
  });
});

describe("mapAxeViolationToFindings - catalog miss fallback", () => {
  it("maps axe impact to severity when rule is not in catalog", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({ id: "custom-unknown-rule", impact: "serious" }),
      PAGE_URL,
    );
    expect(finding?.severity).toBe("critical");
  });

  it("uses axe help text as title when rule is not in catalog", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({ id: "custom-unknown-rule", help: "Custom help text" }),
      PAGE_URL,
    );
    expect(finding?.title).toBe("Custom help text");
  });

  it("uses generic recommendation referencing helpUrl when rule is not in catalog", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({
        id: "custom-unknown-rule",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/custom-unknown-rule",
      }),
      PAGE_URL,
    );
    expect(finding?.recommendation).toContain("axe-core documentation");
    expect(finding?.recommendation).toContain(
      "https://dequeuniversity.com/rules/axe/4.10/custom-unknown-rule",
    );
  });

  it("falls back to extractWcag from tags when rule is not in catalog", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({ id: "custom-unknown-rule", tags: ["wcag2a", "wcag143"] }),
      PAGE_URL,
    );
    expect(finding?.wcag).toBe("1.4.3");
  });

  it("sets wcag null when tags have no numeric clause tag", () => {
    const [finding] = mapAxeViolationToFindings(
      makeViolation({ id: "custom-unknown-rule", tags: ["wcag2aa", "best-practice"] }),
      PAGE_URL,
    );
    expect(finding?.wcag).toBeNull();
  });

  it("emits debug warning to stderr when FOXHOLE_DEBUG=1", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    process.env.FOXHOLE_DEBUG = "1";

    mapAxeViolationToFindings(makeViolation({ id: "custom-unknown-rule" }), PAGE_URL);

    expect(stderr).toHaveBeenCalledWith(
      "[foxhole:debug] catalog gap: ruleId=a11y/custom-unknown-rule\n",
    );

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });

  it("does not emit debug warning when FOXHOLE_DEBUG is unset", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const prev = process.env.FOXHOLE_DEBUG;
    delete process.env.FOXHOLE_DEBUG;

    mapAxeViolationToFindings(makeViolation({ id: "custom-unknown-rule" }), PAGE_URL);

    expect(stderr).not.toHaveBeenCalled();

    process.env.FOXHOLE_DEBUG = prev;
    stderr.mockRestore();
  });
});

describe("mapAxeViolationToFindings - multi-node", () => {
  it("produces one Finding per node", () => {
    const violation = makeViolation({
      id: "image-alt",
      nodes: [
        { target: ["img.hero"], html: '<img class="hero">' },
        { target: ["img.logo"], html: '<img class="logo">' },
      ],
    });
    const findings = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(findings).toHaveLength(2);
  });

  it("produces distinct IDs for distinct nodes", () => {
    const violation = makeViolation({
      id: "image-alt",
      nodes: [
        { target: ["img.hero"], html: '<img class="hero">' },
        { target: ["img.logo"], html: '<img class="logo">' },
      ],
    });
    const findings = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(findings[0]?.id).not.toBe(findings[1]?.id);
  });

  it("sets selector to null for missing node target", () => {
    const violation = makeViolation({
      nodes: [{ target: [], html: "<img>" }],
    });
    const [finding] = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(finding?.selector).toBeNull();
  });
});

describe("mapAxeViolationToFindings - no-nodes case", () => {
  it("produces one Finding with null selector when nodes is empty", () => {
    const violation = makeViolation({ id: "document-title", nodes: [] });
    const findings = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.selector).toBeNull();
  });
});

describe("mapAxeViolationToFindings - ID stability", () => {
  it("produces the same ID across two calls for the same violation on the same page", () => {
    const violation = makeViolation({ id: "image-alt" });
    const [a] = mapAxeViolationToFindings(violation, PAGE_URL);
    const [b] = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(a?.id).toBe(b?.id);
  });

  it("produces different IDs for the same violation on different pages", () => {
    const violation = makeViolation({ id: "image-alt" });
    const [a] = mapAxeViolationToFindings(violation, "https://example.com/page-a");
    const [b] = mapAxeViolationToFindings(violation, "https://example.com/page-b");
    expect(a?.id).not.toBe(b?.id);
  });

  it("produces 16-character hex IDs", () => {
    const [finding] = mapAxeViolationToFindings(makeViolation(), PAGE_URL);
    expect(finding?.id).toHaveLength(16);
    expect(finding?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("mapAxeViolationToFindings - selector handling", () => {
  it("truncates selectors over 200 characters", () => {
    const longSelector = "a".repeat(250);
    const violation = makeViolation({
      nodes: [{ target: [longSelector], html: "<a>" }],
    });
    const [finding] = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(finding?.selector?.length).toBeLessThanOrEqual(200);
  });

  it("strips angle brackets from selectors", () => {
    const violation = makeViolation({
      nodes: [{ target: ["div > <span>"], html: "<span>" }],
    });
    const [finding] = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(finding?.selector).not.toContain("<");
    expect(finding?.selector).not.toContain(">");
  });

  it("strips backticks from selectors", () => {
    const violation = makeViolation({
      nodes: [{ target: ["div[data-x=`foo`]"], html: "<div>" }],
    });
    const [finding] = mapAxeViolationToFindings(violation, PAGE_URL);
    expect(finding?.selector).not.toContain("`");
  });
});

describe("mapAxeViolationToFindings - fixture round-trip", () => {
  it("maps all violations in axe-raw.json without throwing", () => {
    const violations = loadFixture();
    expect(() => {
      violations.flatMap((v) => mapAxeViolationToFindings(v, PAGE_URL));
    }).not.toThrow();
  });

  it("produces well-formed findings from the fixture", () => {
    const violations = loadFixture();
    const findings = violations.flatMap((v) => mapAxeViolationToFindings(v, PAGE_URL));
    for (const finding of findings) {
      expect(finding.id).toHaveLength(16);
      expect(finding.category).toBe("a11y");
      expect(finding.rule_id).toMatch(/^a11y\//);
      expect(finding.source).toBeNull();
      expect(finding.url).toBe(PAGE_URL);
    }
  });
});

describe("parseAxeViolations", () => {
  const validViolation = {
    id: "image-alt",
    impact: "critical",
    description: "Ensures img elements have alternate text",
    help: "Images must have alternate text",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
    tags: ["wcag2a"],
    nodes: [{ target: ["img"], html: "<img>" }],
  };

  it("accepts a valid violations array", () => {
    const result = parseAxeViolations([validViolation]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("image-alt");
  });

  it("accepts an empty array", () => {
    expect(parseAxeViolations([])).toEqual([]);
  });

  it("throws RunnerError when input is not an array", () => {
    expect(() => parseAxeViolations({ violations: [] })).toThrow(RunnerError);
  });

  it("throws RunnerError when a violation is missing required fields", () => {
    expect(() => parseAxeViolations([{ id: "foo" }])).toThrow(RunnerError);
  });

  it("throws RunnerError when nodes entries are missing required fields", () => {
    const bad = { ...validViolation, nodes: [{ html: "<img>" }] };
    expect(() => parseAxeViolations([bad])).toThrow(RunnerError);
  });
});
