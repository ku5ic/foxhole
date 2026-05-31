import { describe, it, expect } from "vitest";

import {
  mapSemanticResultToFindings,
  parseSemanticResults,
  type SemanticCheckResult,
} from "../../src/runner/semantic.js";
import { RunnerError } from "../../src/errors.js";

const PAGE_URL = "https://example.com";

function makeResult(check: string, issues: SemanticCheckResult["issues"]): SemanticCheckResult {
  return { check, issues };
}

function single(
  detail: string,
  selector: string | null = null,
  outerHTML: string | null = null,
): SemanticCheckResult["issues"] {
  return [{ selector, detail, outerHTML }];
}

describe("missing-h1", () => {
  const result = makeResult("missing-h1", single("Page has no h1 element"));

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Missing h1 element");
  });

  it("uses catalog severity (major)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("major");
  });

  it("uses catalog recommendation", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.recommendation).toContain("h1");
  });

  it("sets selector to null (no specific element)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.selector).toBeNull();
  });
});

describe("multiple-h1", () => {
  // multiple-h1 is on a separate fixture because it cannot coexist with missing-h1
  const result = makeResult(
    "multiple-h1",
    single("Page has 2 h1 elements", "h1", "<h1>Duplicate heading</h1>"),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Multiple h1 elements");
  });

  it("uses catalog severity (minor)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("minor");
  });

  it("builds semantic path from outerHTML", () => {
    const result2 = makeResult(
      "multiple-h1",
      single("Page has 2 h1 elements", "h1", '<h1 id="dup">Duplicate</h1>'),
    );
    const [finding] = mapSemanticResultToFindings(result2, PAGE_URL);
    expect(finding?.id).toBeDefined();
  });
});

describe("skipped-heading-level", () => {
  const result = makeResult(
    "skipped-heading-level",
    single("Heading level skipped from h2 to h4", "h4", "<h4>Subsection</h4>"),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Skipped heading level");
  });

  it("uses catalog severity (minor)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("minor");
  });
});

describe("interactive-no-text", () => {
  const result = makeResult(
    "interactive-no-text",
    single("button has no accessible text", "button", "<button></button>"),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Interactive element without accessible text");
  });

  it("uses catalog severity (major)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("major");
  });
});

describe("input-no-label", () => {
  const result = makeResult(
    "input-no-label",
    single("Form input has no associated label", "input", '<input type="email">'),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Form input without associated label");
  });

  it("uses catalog severity (major)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("major");
  });
});

describe("img-no-alt", () => {
  const result = makeResult(
    "img-no-alt",
    single("Image has no alt attribute", "img", '<img src="hero.png">'),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Image missing alt attribute");
  });

  it("uses catalog severity (major)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("major");
  });
});

describe("fake-button-no-keyboard", () => {
  const result = makeResult(
    "fake-button-no-keyboard",
    single(
      "Element with role=button has no tabindex for keyboard access",
      'div[role="button"]',
      '<div role="button">Click me</div>',
    ),
  );

  it("uses catalog title", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.title).toBe("Custom button missing keyboard access");
  });

  it("uses catalog severity (minor)", () => {
    const [finding] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(finding?.severity).toBe("minor");
  });
});

describe("catalog fields applied to all checks", () => {
  it("sets source: null on every finding", () => {
    const checks = [
      "missing-h1",
      "multiple-h1",
      "skipped-heading-level",
      "interactive-no-text",
      "input-no-label",
      "img-no-alt",
      "fake-button-no-keyboard",
    ];
    for (const check of checks) {
      const [finding] = mapSemanticResultToFindings(
        makeResult(check, single("detail", null, null)),
        PAGE_URL,
      );
      expect(finding?.source).toBeNull();
      expect(finding?.wcag).toBeNull();
      expect(finding?.impact).toBeNull();
      expect(finding?.category).toBe("semantic");
    }
  });
});

describe("ID stability", () => {
  it("produces the same ID across two calls for the same issue on the same page", () => {
    const result = makeResult("missing-h1", single("Page has no h1 element"));
    const [a] = mapSemanticResultToFindings(result, PAGE_URL);
    const [b] = mapSemanticResultToFindings(result, PAGE_URL);
    expect(a?.id).toBe(b?.id);
  });

  it("produces different IDs for the same check on different pages", () => {
    const result = makeResult("missing-h1", single("Page has no h1 element"));
    const [a] = mapSemanticResultToFindings(result, "https://example.com/a");
    const [b] = mapSemanticResultToFindings(result, "https://example.com/b");
    expect(a?.id).not.toBe(b?.id);
  });

  it("produces 16-character hex IDs", () => {
    const [finding] = mapSemanticResultToFindings(
      makeResult("missing-h1", single("Page has no h1 element")),
      PAGE_URL,
    );
    expect(finding?.id).toHaveLength(16);
    expect(finding?.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("parseSemanticResults", () => {
  const validResult = {
    check: "missing-h1",
    issues: [{ selector: null, detail: "Page has no h1 element", outerHTML: null }],
  };

  it("accepts a valid results array", () => {
    const result = parseSemanticResults([validResult]);
    expect(result).toHaveLength(1);
    expect(result[0]?.check).toBe("missing-h1");
  });

  it("accepts an empty array", () => {
    expect(parseSemanticResults([])).toEqual([]);
  });

  it("throws RunnerError when input is not an array", () => {
    expect(() => parseSemanticResults("not an array")).toThrow(RunnerError);
  });

  it("throws RunnerError when a result is missing the check field", () => {
    expect(() => parseSemanticResults([{ issues: [] }])).toThrow(RunnerError);
  });

  it("throws RunnerError when an issue is missing the detail field", () => {
    const bad = { check: "foo", issues: [{ selector: null, outerHTML: null }] };
    expect(() => parseSemanticResults([bad])).toThrow(RunnerError);
  });
});
