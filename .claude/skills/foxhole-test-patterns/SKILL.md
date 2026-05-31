---
name: foxhole-test-patterns
description: Test conventions specific to the foxhole project. Use whenever adding or modifying any test file in tests/, OR the user asks about test structure, fixtures, mocking strategy, or coverage requirements in this project.
metadata:
  type: project
---

# Skill: Foxhole test patterns

Foxhole uses Vitest. Tests mirror `src/` structure under `tests/`. Every module has a corresponding test file.

## Test file naming

```
src/runner/axe.ts          -> tests/runner/axe.test.ts
src/audit/score.ts         -> tests/audit/score.test.ts
src/report/markdown.ts     -> tests/report/markdown.test.ts
src/config/load.ts         -> tests/config/load.test.ts
```

## Test structure

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

import { mapAxeViolationToFindings } from "../../src/runner/axe.js";
import type { Finding } from "../../src/types/index.js";

describe("mapAxeViolationToFindings", () => {
  it("maps critical axe-core impact to critical severity", () => {
    // arrange
    // act
    // assert
  });

  it("maps serious axe-core impact to critical severity", () => {
    // arrange
    // act
    // assert
  });
});
```

## Coverage requirements

- Every exported function has at least one test.
- Every severity mapping path is tested explicitly.
- Every error path is tested. If a function can throw, that path must be covered.
- Happy path and at least one failure path per function.

## What to test per layer

### `src/runner/`

- Finding normalization: one test per severity mapping, one per effort mapping
- Selector handling: `null` when not available, truncation at 200 chars, backtick/angle-bracket removal
- WCAG mapping: correct clause extraction from axe-core tags
- Runner errors: what happens when Playwright fails, when axe-core throws
- Bundle classification: `kind` field set correctly for framework vs application chunks

### `src/audit/`

- Scoring: correct weighted averages, edge cases at 0 and 100, `exclude_framework` flag behavior
- Prioritization: correct ranking order, tie-breaking behavior
- Diff: regressions identified correctly, improvements identified correctly
- Summarize: output is a non-empty string, does not contain forbidden characters (em dash, smart quotes)

### `src/report/`

- Markdown renderer: snapshot test against `tests/fixtures/sample-report.json`
- All sections present in the correct order
- No em dashes or smart quotes in output
- Framework bundle size splits render correctly when `framework_bundle_size` is non-null

### `src/config/`

- Valid config loads without error
- Missing required fields produce a `ConfigError`
- CLI flags override config file values correctly
- `exclude_framework` defaults to `false`

### `src/cli/commands/`

- Valid input delegates to audit layer
- Missing required flags exit with code 2
- `--build` without `--urls` exits with code 2
- Score below threshold exits with code 1
- Runtime errors exit with code 2

## Fixtures

Use fixtures for complex input. Do not construct large objects inline.

```
tests/fixtures/sample-report.json     complete AuditReport (includes framework_bundle_size)
tests/fixtures/sample-diff.json       RunDiff for compare tests
tests/fixtures/axe-raw.json           raw axe-core violations array
tests/fixtures/lighthouse-raw.json    raw Lighthouse result object
tests/fixtures/static/index.html      minimal HTML page for --build mode tests
tests/fixtures/static/multiple-h1.html   page with multiple h1 (semantic test target)
tests/fixtures/static/spa.html        SPA-style single-page fixture
```

## Mocking

- Mock Playwright at the `browser.ts` boundary. Never let tests open a real browser.
- Mock file system operations in config and report tests.
- Do not mock the audit layer when testing CLI commands. Use the real audit layer with mocked runners.

```typescript
vi.mock("../../src/runner/browser.ts", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  createBrowser: vi.fn().mockResolvedValue(mockBrowser),
}));
```

## Snapshot tests

Use snapshots only for the report renderer output. Do not use snapshots for logic tests -- they hide regressions.

```typescript
it("renders a complete markdown report", () => {
  const report = JSON.parse(fs.readFileSync("tests/fixtures/sample-report.json", "utf8"));
  const markdown = renderMarkdownReport(report);
  expect(markdown).toMatchSnapshot();
});
```

## Anti-patterns

**failure**: Letting a test open a real Chromium browser. All Playwright calls must be mocked.

**failure**: Writing assertions that test implementation details (e.g. checking that a specific internal function was called). Test observable output: return values, thrown errors, and side effects on shared state.

**failure**: Tests that depend on execution order. Each test must be independent; use `beforeEach` to reset state.

**warning**: Constructing large `AuditReport` or `Finding` objects inline. Use fixture files or factory helpers.

**warning**: Snapshot tests for scoring or normalization logic. Snapshots make it hard to see what changed when a test fails.

**info**: Skipping error path coverage on the grounds that "it can't happen." If a function throws a `RunnerError`, the throw path must be covered.

## When to load this skill

- Adding or modifying any test file in `tests/`
- Debugging a failing test
- Reviewing test coverage for a new feature

## When not to load this skill

- Working in `src/` without touching tests
- Reviewing fixture JSON files for schema correctness (use the finding-normalization skill instead)

## References

- `vitest.config.ts` -- test runner configuration
- `tests/fixtures/` -- all fixture files
- `src/runner/browser.ts` -- the correct mock boundary for Playwright
- Global test-patterns skill -- general Vitest patterns, testing principles, and coverage discipline
