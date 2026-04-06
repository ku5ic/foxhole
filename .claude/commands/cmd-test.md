Write tests for the code produced by cmd-implement. Follow the test patterns skill exactly.

## Before writing tests

- Load the test patterns skill
- Load the implementation files being tested
- Identify every exported function that needs coverage
- Identify every error path that needs coverage

## Test requirements

### Coverage rules

- Every exported function has at least one test
- Every severity and effort mapping has an explicit test
- Every error path has a test
- Every Result type return has tests for both ok and err cases
- No test depends on another test

### File location

Tests mirror the src/ structure under tests/:

- src/runner/axe.ts -> tests/runner/axe.test.ts
- src/audit/score.ts -> tests/audit/score.test.ts

### Fixture requirement

If a test requires a complex object (AuditReport, raw axe-core output, raw Lighthouse output), create a fixture file rather than constructing it inline.

Fixture location: tests/fixtures/

### Mocking rules

- Mock Playwright at the browser.ts boundary
- Mock file system operations in config and report tests
- Do not mock the audit layer when testing CLI commands

## Test output format

After writing tests, produce a summary:

- Files created
- Total test count
- Coverage by category:
  - Happy path tests
  - Error path tests
  - Edge case tests
- Any paths that could not be tested and why

## Quality bar

Tests must fail for the right reason. A test that passes when the implementation is broken is worse than no test. Before finalizing, mentally verify that each test would catch the specific regression it is designed to catch.
