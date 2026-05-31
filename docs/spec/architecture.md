# Foxhole architecture spec

Version: 1.0.0
Status: Draft, pending review
Owner: Sinisa
Last updated: 2026-04-30
Depends on: docs/spec/v1.md

This document is the engineering design for Foxhole v1. It defines module boundaries, interfaces, the execution model, and the rules that govern how components fit together. The product spec describes what Foxhole does. This document describes how it is built.

Implementation details (specific function signatures, library version pins, exact file contents) belong in phase specs, not here.

## 1. Module boundaries

The folder structure from the v1 spec is the architecture. Each top-level module under `src/` owns one concern and is forbidden from leaking that concern across boundaries. Cross-module communication goes through typed interfaces defined in `src/types/`.

### 1.1 `src/cli/`

Owns: argument parsing, flag validation, config resolution, command dispatch, exit code mapping.

Does not own: audit logic, rendering, MCP transport. The CLI is a thin shell that builds a `RunInput` and hands it to the orchestrator.

Key files:

- `index.ts`: entry point, sets up Commander, dispatches to commands
- `commands/run.ts`, `commands/compare.ts`, `commands/report.ts`, `commands/init.ts`: one file per command, each builds its input and calls the appropriate orchestrator function
- `options.ts`: shared flag definitions and validation helpers, used by multiple commands

The CLI never imports from `runner/` or `report/` directly. It imports from `audit/` (the orchestrator), `config/` (for resolution), and `types/`.

### 1.2 `src/runner/`

Owns: executing audit checks against a loaded page, returning normalized `Finding[]` and category-specific raw data (perf metrics, bundle stats).

Does not own: scoring, prioritization, rendering, orchestration across pages. Runners are stateless executors of a single check against a single page.

Key files:

- `index.ts`: exports `runAudit`, the concurrency harness (`runWithConcurrency`), and shared types. A formal `Runner` interface and category registry are the intended design but are not yet implemented.
- `browser.ts`: Playwright context lifecycle (launch, navigate, wait, close), shared by all runners
- `lighthouse.ts`, `axe.ts`, `semantic.ts`, `bundle.ts`: one file per runner, each exposes a typed async function. They do not yet implement a shared `Runner` interface.

Runners depend only on `browser.ts`, the runner interface, and `types/`. They never import from `audit/`, `report/`, or `cli/`.

### 1.3 `src/audit/`

Owns: orchestration of runners across pages, score calculation, fix prioritization, summary generation, run-to-run diffing.

Does not own: how checks are executed, how output is rendered, how MCP tools are exposed. The audit module is the glue between runners and consumers.

Key files:

- `index.ts`: the orchestrator, the function that takes a `RunInput` and returns an `AuditReport`
- `score.ts`: pure functions for computing category and overall scores from findings
- `prioritize.ts`: pure functions for ranking and deduplicating fixes across pages
- `summarize.ts`: pure functions for generating the deterministic summary string
- `diff.ts`: pure functions for comparing two `AuditReport` instances and producing a `RunDiff`

Everything in `audit/` except `index.ts` is pure. No I/O, no browser, no filesystem. This makes the entire scoring and prioritization logic trivially testable with fixture inputs.

### 1.4 `src/server/`

Owns: the internal static HTTP server used by `--build` mode.

Does not own: anything else. This module exists solely to serve a build directory on a local port for the duration of an audit run.

Key files:

- `static.ts`: server lifecycle (start on dynamic port, serve files, SPA fallback, shutdown)

### 1.5 `src/report/`

Owns: rendering an `AuditReport` or `RunDiff` as markdown.

Does not own: scoring, audit logic, anything that mutates report data. The renderer is a pure transformation from structured data to a string.

Key files:

- `markdown.ts`: the rendering function
- `templates/report.md`: the markdown template, with placeholder syntax for field interpolation

The renderer never reaches back into runners, browser state, or filesystem. Its input is an `AuditReport`, its output is a string.

### 1.6 `src/mcp/`

Owns: MCP protocol transport and tool handler wiring.

Does not own: audit logic, scoring, rendering. MCP tool handlers are thin adapters that translate MCP tool inputs into orchestrator calls and orchestrator outputs into MCP tool responses.

Key files:

- `index.ts`: server setup, stdio transport wiring, tool registration
- `tools/*.ts`: one file per tool, each is a thin handler that calls into `audit/` or `report/`

### 1.7 `src/config/`

Owns: loading and validating config files, merging CLI flags with config and defaults, producing a normalized config object.

Does not own: how config is consumed downstream. This module produces a typed config; everything else accepts it as input.

Key files:

- `load.ts`: file resolution, JSON parsing, Zod validation
- `defaults.ts`: the canonical default values
- `schema.ts`: the Zod schema for the config file

### 1.8 `src/types/`

Owns: all shared type definitions. The contracts that bind the modules together.

Does not own: any runtime code. Types only.

This is where `Finding`, `AuditReport`, `Runner`, `RunInput`, and every other shared interface lives.

## 2. The runner interface

The runner interface is the dependency inversion line. The orchestrator depends on this interface, not on Lighthouse, axe-core, or Playwright. Implementations are interchangeable.

> **Implementation status:** The `Runner` interface, `RunnerContext`, and `RunnerResult` shapes below represent the intended design. The current implementation uses individual runner functions (`runAxe`, `runLighthouse`, `runSemanticChecks`, `runBundleChecks`) without a formal interface or registry. `RunnerContext.signal` (AbortSignal) and `RunnerContext.buildRoot` are not yet threaded through. The shapes here are the target; see section 4.4 and the runner deferred items in PHASES.md.

### 2.1 Shape

```typescript
export interface RunnerContext {
  page: Page; // Playwright Page, already navigated and waited
  url: string; // canonical URL of the current target
  buildRoot: string | null; // filesystem path when in --build mode, null otherwise
  signal: AbortSignal; // cancellation, honored by all runners
}

export interface RunnerResult {
  findings: Finding[];
  metrics?: Partial<PerformanceMetrics>; // perf runner populates this, others may not
  status: "ok" | "errored";
  error?: { message: string; stack: string | null };
}

export interface Runner {
  category: CheckCategory;
  run(context: RunnerContext): Promise<RunnerResult>;
}
```

### 2.2 Contract

Every runner must:

1. Accept a `RunnerContext`. Never launch its own browser, never re-navigate the page, never assume anything about wait state beyond what the orchestrator guarantees.
2. Return a `RunnerResult` with normalized `Finding` objects. Never return raw axe nodes, raw Lighthouse audits, or raw network entries. Normalization happens inside the runner before returning.
3. Honor `signal.aborted`. Long-running work (Lighthouse especially) must check the signal and bail out cleanly.
4. Catch its own errors and return `status: "errored"` with the error captured. Throwing escapes the runner contract and is a bug.
5. Be stateless across invocations. Two calls to the same runner with the same context must produce equivalent results (modulo Lighthouse variance, which is a known tradeoff).

### 2.3 Why this shape

The orchestrator code is then trivial:

```
for each runner in selectedRunners:
  result = await runner.run(context)
  collectFindings(result)
  if result.status === "errored":
    markCategoryAsErrored(runner.category, result.error)
```

Adding a new check (security, SEO, etc.) post-v1 is a matter of writing a new runner that satisfies this interface and registering it. No orchestrator changes required.

## 3. Data flow

The full sequence from `foxhole run --url https://example.com` to rendered output:

1. `cli/index.ts` parses argv with Commander, dispatches to `cli/commands/run.ts`.
2. `commands/run.ts` calls `config/load.ts` to resolve the merged config (defaults + config file + CLI flags), validated through Zod.
3. `commands/run.ts` constructs a `RunInput` and calls `audit/index.ts` (the orchestrator).
4. The orchestrator launches one Playwright browser via `runner/browser.ts`. Single browser process for the entire run.
5. For each target URL (sequentially by default, parallel if `--concurrency > 1`):
   a. Open a new page in a fresh context (isolated cookies, isolated cache)
   b. Navigate, wait for `networkidle + 500ms`, plus any `--wait-for` selector
   c. Run the requested checks against this page (see execution model in section 4)
   d. Resolve source maps for findings (see section 7)
   e. Close the page context
6. The orchestrator collects per-page `PageResult` objects.
7. `audit/score.ts` computes scores, `audit/prioritize.ts` computes the fix list, `audit/summarize.ts` writes the summary string. All pure functions.
8. The orchestrator assembles the `AuditReport` and tears down the browser.
9. If `--output markdown`, `report/markdown.ts` renders the report. If `--output json`, the report is serialized directly.
10. `commands/run.ts` writes to the output destination (stdout or file) and returns an exit code based on `AuditReport.meta.passed` and the threshold.

The MCP path is identical from step 3 onward. Only the entry point differs. This is the architectural payoff of keeping the orchestrator pure.

## 4. Execution model

### 4.1 Single browser, single context per page

> **Implementation status:** The current code creates one Playwright `BrowserServer` per page and tears it down after each page audit (see `runner/index.ts::auditSinglePage`). This is documented as a known limitation in README.md and PHASES.md. Single-browser-for-the-entire-run is the target design and is recorded as deferred work.

One Playwright `Browser` instance for the entire run. One `BrowserContext` per audited URL, created fresh and torn down after the page is audited. Within a context, one `Page`.

Multiple Chrome instances is the existing tech debt item that this design closes. Tests verify only one Chromium process exists during a run.

### 4.2 Two-pass per page

axe, semantic, and bundle are pure DOM and network reads. They do not interfere with each other. Lighthouse needs to control navigation, throttle the network, and reload the page to measure cold-start performance.

The execution per page is two passes:

> **Implementation status:** Pass 1 currently runs sequentially (a11y, then perf, then semantic, then bundle), not in parallel. Concurrent Pass 1 execution is the target design for a later phase.

**Pass 1:** axe, semantic, and bundle run against the loaded page. They share the same `Page` instance. Bundle analysis reads from the network log captured during the initial navigation. Target design is to run these concurrently.

**Pass 2:** Lighthouse runs against the same `Page`. Lighthouse will trigger its own navigation and reload internally; this is acceptable because pass 1 has already completed.

Pass 2 is skipped if `perf` is not in the requested checks. Pass 1 is skipped if none of axe, semantic, or bundle are requested.

### 4.3 Page concurrency

By default, pages are audited sequentially. `--concurrency N` audits N pages in parallel.

Sequential is the default because:

- Lighthouse perf measurements are sensitive to CPU contention. Two Lighthouse runs in parallel produce noisy scores.
- Memory usage scales with concurrency. Some users will run on constrained CI runners.
- Predictable, debuggable runs are easier to reason about than parallel ones.

When `--concurrency > 1`, the runner pool launches up to N browser contexts in parallel, each running the full per-page sequence. Lighthouse still runs sequentially within a single page, but multiple pages are in flight at once.

The orchestrator emits a warning to stderr when `--concurrency > 1` and `perf` is in the requested checks, reminding the user that perf scores will be noisier.

### 4.4 Cancellation

> **Implementation status:** Cancellation via `AbortSignal` is not yet implemented. `RunnerOptions` has no `signal` field and runners accept no signal. SIGINT handling and per-page timeouts are deferred. The design below is the target.

All runners receive an `AbortSignal`. The orchestrator wires the signal to:

- The CLI's SIGINT handler (Ctrl+C cleanly tears down the browser)
- A configurable per-page timeout (default 60 seconds, fails the page with `status: "errored"`, run continues)
- The MCP server's tool call cancellation, if the client disconnects

Cancellation does not corrupt the report. Pages already audited are included; pages in flight at cancellation time are marked errored.

## 5. The normalization layer

This is the most important boundary in the codebase. The seam between vendor types (axe results, Lighthouse audits, network entries) and Foxhole types (`Finding`, `PerformanceMetrics`).

### 5.1 Rule

No code outside of `src/runner/` may import from `axe-core`, `lighthouse`, or any vendor type. The runner is the only place that knows what those libraries return. Everything downstream sees `Finding[]`.

This is enforced by:

1. Code review

> **Not yet implemented:** An ESLint `no-restricted-imports` rule for `axe-core`, `lighthouse`, and `playwright` outside `src/runner/`, and a unit test asserting the boundary, are the intended enforcement mechanisms but have not been configured. They are tracked as open items.

### 5.2 Where normalization lives

Each runner has a private normalization function. `axe.ts` has `normalizeAxeViolation(violation): Finding`. `lighthouse.ts` has `normalizeLighthouseAudit(audit): Finding | null` (returns null for audits that do not map to findings, like info-level diagnostics).

These functions are pure. Tested in isolation against fixture inputs captured from real axe and Lighthouse runs.

### 5.3 What normalization includes

The runner is responsible for:

- Mapping vendor severity to Foxhole `Severity` (`critical`, `major`, `minor`)
- Mapping vendor effort hints to Foxhole `Effort` (`low`, `medium`, `high`), or applying the catalog default for that rule id
- Looking up the Foxhole rule id from the vendor rule id
- Pulling the authored `title`, `description`, and `recommendation` from the findings catalog
- Extracting the selector and impact text
- Setting `source: null` (source map resolution happens later, not in the runner)
- Setting the URL of the page being audited

If the vendor rule id is not in the findings catalog, the runner emits a `Finding` with a generic title and a recommendation pointing at the vendor's own documentation, plus a debug log warning that the catalog is missing this rule. Catalog gaps are bugs, not silent failures.

## 6. Error handling and partial failure

### 6.1 Principle

A runner crashing must not crash the audit. The user gets a report showing what ran successfully and what did not. The architecture prioritizes "the audit ran, here is partial data" over "the audit failed, here is nothing".

This is the partial-failure semantics decision from the v1 spec discussion. It ripples through several places.

### 6.2 Status field on category summary

`CategorySummary` gains a `status` field:

```typescript
export interface CategorySummary {
  category: CheckCategory;
  status: "ok" | "errored" | "skipped";
  error?: { message: string };
  score: number; // 0 if errored or skipped
  findings_count: number; // 0 if errored or skipped
  critical_count: number;
  major_count: number;
  minor_count: number;
}
```

`skipped` means the user did not request this check. `errored` means the runner crashed. `ok` means the runner completed.

This is a schema change relative to the v1 spec's current types section. It is added to the schemas spec and the v1 spec is updated to reference the new shape.

### 6.3 Behavior

If a runner returns `status: "errored"`:

- The category is marked `errored` in the report
- The error message is included in the report (not the stack trace, that goes to stderr at debug level)
- The page score is computed from all findings via exponential decay (ADR-010); errored categories contribute no findings, so their absence lowers the page score only if they would have had findings
- Exit code is 1 if the partial score still falls below threshold, 2 only if no runners completed at all

If page navigation itself fails (the URL is unreachable, browser crashes mid-load):

- The page is marked errored in the report with status at the page level
- Other pages in the run continue
- Exit code is 2 if all pages fail, 1 or 0 based on threshold if some pages succeed

### 6.4 What gets logged where

stderr (always, unless `--quiet`):

- One progress line per page started
- Errors at warn or higher

stderr (only at debug log level):

- Stack traces
- Source map resolution failures
- Vendor-rule-not-in-catalog warnings

stdout:

- The report, and only the report. Never logs, never progress.

This separation is what makes Foxhole work in pipes (`foxhole run ... | jq`).

## 7. Source map resolution

### 7.1 Pipeline

Source map resolution runs after all runners complete for a page, before the `PageResult` is finalized. It mutates each `Finding` to populate the `source` field.

The pipeline:

1. For each finding with a selector pointing at a DOM element:
   a. Locate the element in the page
   b. Walk up to the nearest component boundary (heuristic: nearest element with a data attribute matching common bundlers, falling back to nearest element with a meaningful class name)
   c. Identify the bundle that produced this component (via stack trace if available, via React DevTools fiber if React, via heuristic mapping otherwise)
   d. Fetch and parse the source map for that bundle (cached per run)
   e. Resolve to source file, line, column
   f. Read the source file, extract a snippet (the offending line plus 1 line of context)
   g. Verify the file exists; if not, set `source: null` and continue

2. For findings from network analysis (bundle, perf):
   a. The bundle URL is the artifact
   b. Source map resolves bundle URL to source file directly

3. For findings without a clear runtime artifact (some semantic findings, run-level metrics):
   a. `source: null`

### 7.2 Library choice

`@jridgewell/trace-mapping` is used for source map parsing. Faster than `source-map`, actively maintained, used by Vite and esbuild. The `source-map` package is older and slower.

Source map fetching uses native `fetch` for `--url` mode and `fs.readFile` for `--build` mode. No additional HTTP client dependency.

### 7.3 Caching

Source maps are cached in memory for the duration of a single run, keyed by source map URL or path. A 10-route SPA that shares a single bundle resolves the source map once, not ten times.

The cache is dropped at the end of the run. No persistent caching in v1; the speed gain is not worth the staleness risk.

### 7.4 Failure modes

Documented in section 10 of the v1 spec. The implementation guarantees:

- A failed resolution sets `source: null` and the finding ships
- A resolved path that does not exist on disk (in `--build` mode) is discarded
- `--source-maps off` skips the entire pipeline
- `--source-maps on` logs a warning per failed resolution; `auto` logs at debug level only
- Cross-origin source-map URLs are not fetched in v1, per v1 spec 10.3

## 8. Internal static server

### 8.1 Lifecycle

When `--build` is used:

1. Orchestrator calls `server/static.ts` to start a server pointed at the build directory
2. Server selects a port: tries 3000, 3001, ... up to 3999, falls back to OS-assigned ephemeral port
3. Server is started, returns its port number
4. Orchestrator constructs target URLs by joining the server URL with the paths from `--urls`
5. Audit runs as normal
6. Orchestrator calls server shutdown after the report is assembled

The server is a Node `http` module instance with a small handler. No `serve-handler` or Express dependency. Static file serving plus SPA fallback is 50 lines of code.

### 8.2 SPA fallback

Default behavior: if a request resolves to a file inside the build directory, serve it. Otherwise, serve `index.html` if it exists. Otherwise, 404.

This matches the standard SPA hosting model. It can be disabled in v1.1 if a real use case emerges; v1 ships with fallback always on.

### 8.3 Security

The server binds to `127.0.0.1` only, never `0.0.0.0`. The port is random within the configured range. Requests are scoped to the build directory; path traversal (`..` segments) is rejected. The server is up only for the duration of the audit run.

This is a local development tool. It is not designed for hostile networks.

## 9. MCP server

### 9.1 Invocation

`foxhole mcp` is a CLI subcommand. It launches the MCP server on stdio and never exits until stdin closes.

> **Implementation status:** `cli/commands/mcp.ts` does not exist yet. The `foxhole mcp` subcommand has not been registered in `cli/index.ts`. `startMcpServer()` is implemented in `mcp/index.ts` but is not wired to a CLI command. This is Phase 6 work.

The subcommand will be registered in `cli/commands/mcp.ts`. It imports from `mcp/index.ts`, which sets up the `@modelcontextprotocol/sdk` server, registers tool handlers from `mcp/tools/*.ts`, and starts the stdio transport.

### 9.2 Tool handlers

Each tool handler:

1. Validates the tool input against a Zod schema (input shapes defined in `mcp/tools/*.ts`)
2. Constructs a `RunInput` (for audit-running tools) or accepts a JSON report directly (for `compare_runs`, `generate_report`, `get_prioritized_fixes`)
3. Calls the same orchestrator function the CLI calls
4. Wraps the result in the MCP response shape

The orchestrator is identical between CLI and MCP. There is no MCP-specific audit code. This is the architectural commitment that prevents the two surfaces from drifting.

### 9.3 Statelessness

Per the v1 spec, the MCP server holds no state across tool calls. Each call is self-contained. Reports are passed in by the caller when needed, not cached.

This means `get_prioritized_fixes` and `compare_runs` accept full report JSON as input, not a report id. This is intentional. State management is a hosted-tier concern, not a v1 CLI concern.

### 9.4 Concurrency

The MCP server can receive multiple tool calls in parallel. The orchestrator is concurrency-safe (it does not share state across calls), but Playwright browser launches are expensive. The MCP server limits concurrent audit runs to 1 by default, queueing additional calls. This is a hard limit in v1; making it tunable is a post-v1 concern.

Tool calls that do not run audits (`generate_report`, `compare_runs`, `get_prioritized_fixes`) bypass the queue and run in parallel.

## 10. Configuration loading

### 10.1 Resolution sequence

The sequence is split across three locations in the current implementation:

- `config/load.ts::loadConfig`: reads, parses, and validates a single config file path it is given. Does not discover files or merge flags.
- `commands/run.ts::loadConfigForRun`: auto-discovers `foxhole.config.json` in the current working directory when `--config` is not set.
- `config/resolve-options.ts::resolveRunOptions`: merges CLI flags over config values and falls back to defaults from `config/defaults.ts`.

The full sequence:

1. Start with defaults from `config/defaults.ts` (applied in `resolveRunOptions`)
2. Look for `foxhole.config.json` in cwd via `loadConfigForRun`; if present, load via `loadConfig`
3. If `--config` is provided, load that file via `loadConfig` instead
4. Merge CLI flags over the loaded config in `resolveRunOptions`
5. Return a fully typed `ResolvedRunOptions`

Each step is a pure function. The merge is shallow at the top level; arrays (`urls`, `checks`) are replaced wholesale, not concatenated. Concatenation is surprising; replacement is predictable.

### 10.2 Validation

Zod schema in `config/schema.ts`. Strict mode (no unknown fields). Helpful error messages on validation failure, pointing at the specific field and expected type.

The schema is the source of truth for the config shape. The TypeScript types in `types/` are derived from it via `z.infer`, not duplicated.

### 10.3 Path resolution

Relative paths in config files (e.g. `"out": "./audits"`) are resolved relative to the config file's location, not `process.cwd()`. This is implemented at the boundary between parsing and merging: as soon as a config file is parsed, its path-typed fields are converted to absolute paths.

CLI flags resolve relative paths against `process.cwd()`, which matches user expectation.

## 11. Logging and progress output

### 11.1 Channels

stdout is reserved for the report. Nothing else writes to it. This rule is enforced by a custom logger that has no `info`-level method writing to stdout.

stderr is for everything else: progress, warnings, errors, debug output.

### 11.2 Levels

- `error`: the run cannot continue (browser launch failure, invalid config)
- `warn`: something is wrong but the run continues (catalog gap, source map failure with `--source-maps on`)
- `info`: progress updates (one line per page started, one per page completed)
- `debug`: detail (source map cache hits, individual runner timings, vendor warnings)

`--quiet` suppresses everything below `error`. The default is `info`. There is no flag for `debug` in v1; it is enabled via `FOXHOLE_DEBUG=1` environment variable. Debug output is for development, not for end users.

### 11.3 Format

Plain text, one line per message, no color in CI (auto-detected via `process.stdout.isTTY`). No spinners, no progress bars. Progress is one stderr line per significant event.

This is deliberately boring. Spinners look fine in a terminal, terrible in CI logs, and break if anything else writes to stderr at the same time.

## 12. Test strategy

### 12.1 Unit tests

Pure modules (`audit/score.ts`, `audit/prioritize.ts`, `audit/diff.ts`, `audit/summarize.ts`, runner normalization functions) are tested with fixture inputs and asserted outputs. Coverage target above 90% for these modules.

The findings catalog has tests asserting every entry has the required fields and that severity and effort values are valid. Catalog correctness is a structural check, not a content check.

### 12.2 Integration tests

End-to-end runs against fixture HTML pages served from `tests/fixtures/`. Each input mode (`--url`, `--urls`, `--build`) has at least one integration test. Each output format (json, markdown) has at least one integration test. Each MCP tool has at least one integration test.

Integration tests use a real Playwright browser. They run in CI on Linux only by default; local runs work on macOS and Windows. Cross-platform CI is part of the v1.0.0 acceptance criteria but does not gate every PR.

### 12.3 Snapshot tests

The markdown renderer is snapshot-tested against fixture `AuditReport` JSON. Snapshots are reviewed on every change. This is the safety net for the deterministic output rule: a template change that introduces an AI tell shows up as a snapshot diff.

### 12.4 What is not tested

Lighthouse output stability is not tested. We assume Lighthouse works; we test our normalization of its output.

axe rule outputs are not tested. We assume axe works; we test our normalization.

Browser launch is not tested in unit tests; it is an integration test concern.

## 13. Resolutions to open questions from the v1 spec

The six open questions from section 17 of the v1 spec, resolved:

1. **MCP server invocation: subcommand or separate binary?** Subcommand. `foxhole mcp` launches the server. Single entry point, single distribution.

2. **Internal static server: Node `http` module or `serve-handler`?** Node `http` module. The handler is small enough that the dependency is not justified.

3. **Source map resolution library: `source-map` or `@jridgewell/trace-mapping`?** `@jridgewell/trace-mapping`. Faster, actively maintained, broadly adopted.

4. **Lighthouse integration: programmatic via `lighthouse` package, or `lighthouse-ci` runner?** Programmatic via `lighthouse` package. Foxhole owns the browser context and hands it to Lighthouse. Closes the existing tech debt item about Lighthouse spinning a separate Chrome.

5. **Findings catalog format: TypeScript file, JSON, or YAML?** TypeScript. The catalog is loaded at runtime, type-checked at compile time, and benefits from autocomplete during authoring. JSON loses type safety; YAML adds a parser dependency for no benefit.

6. **How to express "this finding affects N pages" without bloating per-page arrays?** The `Fix` object in `prioritized_fixes` carries `finding_ids` (already in the schema) plus a derived `pages_affected: string[]` field. The per-page `findings` arrays remain authoritative; the prioritized list is a denormalized view. The schemas spec captures this explicitly.

## 14. Schema changes flagged by this spec

Two changes that flow from architectural decisions and need to land in the schemas spec:

1. `CategorySummary` gains `status: "ok" | "errored" | "skipped"` and an optional `error` field. Required for partial-failure semantics (section 6).

2. `Fix` gains `pages_affected: string[]`. Derived field, not authored. Required for the report's top-fixes table to show "affected pages: 3" without scanning the report.

Both are additive. No existing field changes type or meaning. Backward-compatible at the JSON level for any consumer that ignores unknown fields.

## 15. Open questions for the schemas spec

These remain to be resolved when the schemas spec is written:

1. Should `Finding.id` be globally unique within a report, or unique only within a page? Affects how prioritized fixes reference findings.
2. How are runner errors expressed at the report level when no findings exist for that category? Specifically, does an errored category have a `findings: []` or is it omitted?
3. What is the ID generation strategy for findings? A stable hash (rule id + nearest semantic ancestor + text content, per the v1 spec) implies a specific algorithm that needs to be specified exactly.

## 16. Change control

This document is versioned in git alongside the code. Changes to sections 1 (module boundaries), 2 (runner interface), 4 (execution model), 5 (normalization layer), 6 (error handling), 7 (source map pipeline), or 13 (resolutions) require an ADR.

Changes elsewhere can be made directly with a clear commit message.
