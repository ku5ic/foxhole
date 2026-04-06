# Skill: Test patterns

Foxhole uses Vitest as the test runner. Tests are colocated in src/tests/ mirroring the src/ structure. Every module has a corresponding test file. No exceptions.

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

import { mapAxeFinding } from "../../src/runner/axe.ts";
import type { Finding } from "../../src/types/index.ts";

describe("mapAxeFinding", () => {
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
- Every error path is tested. If a function can throw or return an error Result, that path is covered.
- Happy path and at least one failure path per function.

## What to test per layer

### src/runner/

- Finding normalization: one test per severity mapping, one per effort mapping
- Selector handling: null when not available, truncation when too long
- WCAG mapping: correct clause extraction from axe-core tags
- Runner errors: what happens when Playwright fails, when axe-core throws

### src/audit/

- Scoring: correct weighted averages, edge cases at 0 and 100
- Prioritization: correct ranking order, tie-breaking behavior
- Diff: regressions identified correctly, improvements identified correctly, unchanged findings identified correctly
- Summarize: output is a non-empty string, does not contain forbidden characters

### src/report/

- Markdown renderer: snapshot test against fixtures/sample-report.json
- All sections present in correct order
- No em dashes, no smart quotes in output

### src/config/

- Valid config loads without error
- Missing required fields produce a ConfigError
- CLI flags override config file values correctly

### src/cli/commands/

- Valid input delegates to audit layer
- Missing required flags exit with code 2
- Score below threshold exits with code 1
- Runtime errors exit with code 2

## Fixtures

Use fixtures for complex input rather than constructing objects inline.

```
tests/fixtures/sample-report.json     complete AuditReport for renderer tests
tests/fixtures/sample-diff.json       RunDiff for compare tests
tests/fixtures/axe-raw.json           raw axe-core output for normalization tests
tests/fixtures/lighthouse-raw.json    raw Lighthouse output for normalization tests
```

## Mocking

- Mock Playwright at the browser.ts boundary. Never let tests open a real browser.
- Mock file system operations in config and report tests.
- Do not mock the audit layer when testing CLI commands. Use the real audit layer with mocked runners.

```typescript
vi.mock("../../src/runner/browser.ts", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
}));
```

## Snapshot tests

Use snapshots only for report renderer output. Snapshots for logic tests hide regressions.

```typescript
it("renders a complete markdown report", async () => {
  const report = await loadFixture("sample-report.json");
  const markdown = renderMarkdown(report);
  expect(markdown).toMatchSnapshot();
});
```

## What never belongs in tests

- Network requests. All external calls are mocked.
- File system writes to anywhere outside a temp directory.
- Sleep or arbitrary timeouts.
- Tests that depend on execution order.
