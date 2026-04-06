# Phase 0: Foundation hardening

**Status:** Active
**Depends on:** Initial scaffold (all 25 tests passing, clean typecheck and lint)
**Blocks:** Phase 1 (core runners cannot be built on an inconsistent error handling base)

---

## 1. Summary

Close the four known gaps from the scaffold before any feature work begins. This phase does not add new capabilities. It makes the existing code correct and consistent so Phase 1 can build on a solid foundation.

---

## 2. Files

**Modified:**

- `src/cli/commands/run.ts` -- wire `--build` flag to `serveStaticBuild`, tear down server after run
- `src/runner/index.ts` -- wrap per-page run in try/catch, catch `RunnerError`, isolate failures, continue to next page
- `src/runner/axe.ts` -- replace raw throws with `RunnerError`
- `src/runner/lighthouse.ts` -- replace raw throws with `RunnerError`
- `src/runner/semantic.ts` -- replace raw throws with `RunnerError`
- `src/runner/bundle.ts` -- replace raw throws with `RunnerError`
- `src/runner/browser.ts` -- replace raw throws with `RunnerError`
- `README.md` -- add known limitations section

**Not touched:**

- `src/types/index.ts` -- no schema changes
- `src/audit/` -- no audit logic changes
- `src/mcp/` -- no MCP changes
- `src/config/` -- no config changes
- All test files -- existing tests must continue to pass; new tests added for error paths

---

## 3. Implementation steps

### Step 1: Consistent RunnerError across browser.ts

In `src/runner/browser.ts`, wrap each `try/catch` block to throw `RunnerError` instead of re-throwing raw errors or throwing `new Error()`. Specific messages:

- `createBrowser` failure: `"Failed to launch browser"` with original error as `cause`
- `createPage` failure: `"Failed to create browser page"` with original error as `cause`
- `waitForPageReady` failure: `"Page did not reach ready state"` with original error as `cause`

### Step 2: Consistent RunnerError across runner files

In each of `axe.ts`, `lighthouse.ts`, `semantic.ts`, `bundle.ts`, audit every `throw` statement. Replace any `throw new Error(...)` with `throw new RunnerError(...)`. Preserve the original error as `cause`. Do not change function signatures or return types.

Messages follow the pattern: `"Failed to {action} for {context}"`, for example `"Failed to run axe-core audit"`, `"Failed to run Lighthouse audit"`, `"Failed to run semantic checks"`, `"Failed to run bundle analysis"`.

### Step 3: Per-page failure isolation in runner/index.ts

In `runAudit`, the loop over URLs currently has no error handling. Wrap the body of the per-URL loop in try/catch. On `RunnerError`, log the failure to stderr with the `[foxhole]` prefix and the URL that failed, then continue to the next URL. Do not re-throw. Do not abort the run.

The returned `PageResult[]` will contain results only for pages that succeeded. Pages that failed are omitted, not included with empty findings. The caller (audit orchestrator) must handle a result array shorter than the input URL list.

Add a log line for each skipped page: `[foxhole] skipped {url}: {error.message}`.

### Step 4: Wire --build into run command

In `src/cli/commands/run.ts`, in the `handleRun` function:

1. If `options.build` is set, call `serveStaticBuild(options.build)` from `src/server/static.ts`.
2. Capture the returned `{ url, close }`.
3. If `options.urls` contains relative paths (starting with `/`), prepend the local server URL to each path to form absolute URLs.
4. After the audit completes (success or failure), call `close()` to shut down the server.
5. Use a try/finally block to guarantee `close()` is called even if the audit throws.

Validate that `--build` and `--url` are not both set. If both are present, print an error and exit with code 2.

### Step 5: Add known limitations to README

Add a "Known limitations" section to `README.md` after the requirements section. Include:

- Lighthouse runs a separate Chrome instance alongside the Playwright browser. On resource-constrained machines, this may affect performance metrics. Unification is planned for a future release.
- The `--urls` flag requires explicit route listing. Automatic crawling is not available in v1.
- axe-core effort estimates default to "medium" for all findings. Per-rule effort estimation is planned for a future release.

---

## 4. Data flow

No data flow changes. This phase only changes how errors are constructed and propagated, and adds the static server lifecycle to the run command.

```
run command (--build set)
  |
  serveStaticBuild(buildPath)
  |  returns { url: "http://localhost:{port}", close }
  |
  prepend server url to each relative path in --urls
  |
  try {
    runAudit(options)  -- existing flow, unchanged
  } finally {
    close()            -- guaranteed cleanup
  }
```

```
runAudit (per-URL loop)
  |
  for each url:
    try {
      launch browser, run checks, collect findings
    } catch (error: RunnerError) {
      log skip message to stderr
      continue
    }
  |
  return PageResult[] (only successful pages)
```

---

## 5. Error cases

| Failure                             | Error class                         | Behavior                                               |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| Browser fails to launch             | RunnerError                         | Caught at per-page loop, page skipped, audit continues |
| axe-core throws during audit        | RunnerError                         | Caught at per-page loop, page skipped, audit continues |
| Lighthouse throws                   | RunnerError                         | Caught at per-page loop, page skipped, audit continues |
| Static server fails to start        | RunnerError                         | Propagates to CLI top-level handler, exit code 2       |
| --build and --url both set          | (console.error, no throw)           | Print error message, exit code 2 immediately           |
| --build set but path does not exist | RunnerError (from serveStaticBuild) | Propagates to CLI top-level handler, exit code 2       |

The static server failure is not isolated like per-page runner failures. If the server cannot start, the entire run fails because there is nothing to audit. This is intentional.

---

## 6. Test plan

**tests/runner/browser.test.ts (new file):**

- `createBrowser` throws `RunnerError` when browser launch fails (mock chromium.launch to throw)
- `waitForPageReady` throws `RunnerError` when networkidle times out (mock page.waitForLoadState to throw)
- Thrown error includes original error as `cause`

**tests/runner/index.test.ts (new file):**

- `runAudit` continues to next URL when one page throws `RunnerError`
- `runAudit` returns results only for successful pages
- Skipped page is logged to stderr with `[foxhole]` prefix and URL
- `runAudit` with all pages failing returns empty array (no throw)

**tests/cli/run.test.ts (new file):**

- `--build` and `--url` both set exits with code 2
- `--build` set calls `serveStaticBuild` with the provided path
- `serveStaticBuild` close function is called after audit completes
- `serveStaticBuild` close function is called even if audit throws

All existing tests must continue to pass without modification.

---

## 7. Acceptance criteria

Run the following after implementation. All must pass.

```
npm run typecheck   # zero errors
npm run lint        # zero errors
npm run test        # all tests pass including new ones
node bin/foxhole.js --help   # clean output
```

Manual verification:

```bash
# Verify --build wiring (requires a static build directory)
foxhole run --build ./tests/fixtures/static --urls /index.html --output json

# Verify per-page isolation (unreachable URL should be skipped, not abort)
foxhole run --urls https://example.com,https://localhost:9999/unreachable --output json
```

The second command should complete and produce a report for `example.com` only, with a stderr message indicating the unreachable URL was skipped.

---

## 8. Open questions

None. All decisions are resolved per ADR-003 (error handling strategy) and ADR-008 (no crawling). Proceed to `/cmd-implement`.
