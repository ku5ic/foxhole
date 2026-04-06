Review all code and tests produced in this session against the Foxhole quality bar. Be direct. Flag every issue. Do not soften findings.

## Review checklist

Work through every item. Mark each as pass, fail, or not applicable.

### TypeScript

- [ ] No `any` types
- [ ] No non-null assertions
- [ ] Explicit return types on every function
- [ ] Explicit parameter types on every function
- [ ] Named exports only, no default exports
- [ ] Imports ordered correctly (node built-ins, third-party, internal)
- [ ] No types redefined locally that exist in src/types/index.ts

### Architecture

- [ ] Single responsibility: each function does one thing
- [ ] No business logic in CLI command files
- [ ] No rendering logic in runner files
- [ ] No scoring logic in renderer files
- [ ] No direct axe-core or Lighthouse imports outside src/runner/
- [ ] No direct Playwright imports outside src/runner/browser.ts
- [ ] MCP tools delegate to src/audit/, not src/runner/

### Error handling

- [ ] No raw `throw new Error("string")` calls
- [ ] No silent catch blocks
- [ ] All async functions that can fail use Result type or typed error classes
- [ ] CLI top-level error handler maps all error types to correct exit codes
- [ ] No stack traces or internal paths in user-facing error messages

### Security

- [ ] All user-supplied URLs validated before use
- [ ] All user-supplied file paths resolved and validated
- [ ] Selectors sanitized before appearing in report output
- [ ] No secrets, tokens, or environment variables in output
- [ ] No user-supplied strings passed to page.evaluate()

### Finding normalization (if runner code was written)

- [ ] Severity mapping matches the finding-normalization skill exactly
- [ ] Effort mapping matches the finding-normalization skill exactly
- [ ] IDs are stable and follow the {category}-{rule-id} format
- [ ] WCAG field is null for non-a11y findings
- [ ] Impact field is null for non-axe findings
- [ ] Selector is null rather than fabricated when not available

### Report output (if report code was written)

- [ ] Sections appear in the correct order per the markdown-report skill
- [ ] Summary paragraph names specific problems, not categories
- [ ] No em dashes in output
- [ ] No smart quotes in output
- [ ] Recommendations start with a verb
- [ ] Metric values include units

### Tests

- [ ] Every exported function has at least one test
- [ ] Every error path has a test
- [ ] No tests depend on execution order
- [ ] No network requests in tests
- [ ] Complex input uses fixture files, not inline construction
- [ ] Mocks are at the correct boundary

## Output format

For each failed item:

1. State what the issue is
2. Reference the specific file and line
3. State what the correct implementation is

After the checklist, produce an overall verdict:

- Pass: ready to commit
- Pass with minor issues: list the issues, can be committed after fixing
- Fail: list the blocking issues, must be fixed before committing

Do not produce a Pass verdict if any security or architecture items failed.
