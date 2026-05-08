# Foxhole Development Phases

This document is the canonical roadmap for Foxhole v1.0.0. It describes what each phase delivers, what success looks like, and which architectural decisions apply. Detailed implementation instructions for each phase live in `docs/phases/phase-N.md`, written just before the phase begins.

---

## Current state

Phase 0 and Phase 1 are complete. 205 tests pass. All four runners produce schema-valid `Finding[]` with stable IDs. The catalog drives titles, severities, and effort estimates. The audit layer scores, prioritizes, and diffs correctly.

Open items carried into Phase 2:

- `Finding.source` is always null; source map integration is deferred (see Phase 1 Deferred)
- Lighthouse and Playwright open separate Chromium instances (see Phase 1 Deferred)
- `--build` mode exists but has not been tested end-to-end with the Phase 1 runners

---

## Phase 0: Foundation hardening

**Spec:** `docs/phases/phase-0.md`
**Status:** Active

### Objectives

- Wire `--build` into the run command via `serveStaticBuild`
- Adopt consistent typed error handling across the runner layer
- Verify per-page failure isolation in `runner/index.ts`
- Document known limitations in README

### Success criteria

- `foxhole run --build ./dist --urls /index` starts a local server, navigates to the route, and exits cleanly
- A runner failure on one page does not abort the audit of remaining pages
- All runner errors are `RunnerError` instances with a descriptive message and `cause`
- `npm run typecheck`, `npm run lint`, `npm run test` all pass with zero errors

### Relevant decisions

- ADR-003: Error handling strategy
- ADR-005: Lighthouse separate Chrome instance

---

## Phase 1: Schema sync, catalog, and core runners

**Spec:** `docs/phases/phase-1.md`
**Status:** Complete

### Delivered

- Zod runtime schema in `src/types/schema.ts`; all TypeScript types derived via `z.infer`
- Findings catalog in `src/catalog/` with 48 entries covering axe-core, Lighthouse, semantic, and bundle rules
- `src/runner/finding-id.ts`: stable 16-hex-char finding IDs via sha256 of page URL, rule ID, semantic path, and text fingerprint
- All four runners produce `Finding[]` validated against the `Finding` type with catalog-backed titles, severities, and effort estimates
- `audit/score.ts` enforces the length-4 categories invariant: every `PageResult.categories` has exactly 4 entries (ok, errored, or skipped)
- Per-runner error isolation: a failed runner produces an errored `CategorySummary`; the page remains `ok`
- `audit/prioritize.ts` groups fixes by `rule_id` with catalog titles and stable sort
- `audit/diff.ts` computes `comparable` from `perf_profile` and dependency major-version changes
- `RunMeta.dependencies` populated from installed package versions at runtime

### Deferred from Phase 1

- **`Finding.source` (source map integration):** All runners set `source: null`. Resolving bundle coordinates to original source locations via source maps is deferred to Phase 3 or later. Tracked in architecture spec 13.3.
- **Lighthouse + Playwright Chrome unification:** Lighthouse opens a separate Chromium instance from the Playwright page. Sharing the instance requires a Lighthouse custom connection adapter. Deferred; logged in `src/runner/lighthouse.ts`. Tracked in architecture spec 13.4.
- **CLI flag wiring for `--checks` filtering:** `checks_run` is passed through but not yet validated against the config schema at the CLI layer. Deferred to Phase 4 when multi-URL and `--build` plumbing is finalized.

### Relevant decisions

- ADR-001: axe-core and Lighthouse as complementary engines
- ADR-002: Finding normalization schema and stable ID format
- ADR-004: Playwright wait strategy
- ADR-005: Lighthouse separate Chrome instance

---

## Phase 2: Audit layer

**Spec:** `docs/phases/phase-2.md`
**Status:** Planned

### Objectives

- Validate scoring formula against real runner output
- Validate prioritization ordering with multi-category, multi-severity findings
- Validate `summarizeReport` produces useful plain English against real data
- Verify `buildAuditReport` produces a complete, valid `AuditReport` from a live run

### Success criteria

- `foxhole run --url https://example.com --output json` produces a valid `AuditReport` with correct scores, populated `prioritized_fixes`, and a non-empty `summary`
- Score decreases monotonically as findings increase
- Prioritized fixes are ordered by severity then finding count
- `AuditReport` passes JSON schema validation against `src/types/index.ts`

### Relevant decisions

- ADR-002: Finding normalization schema

---

## Phase 3: Report rendering

**Spec:** `docs/phases/phase-3.md`
**Status:** Planned

### Objectives

- Implement `renderMarkdownReport` with all sections per the markdown-report skill
- Enforce section order, tone, and formatting rules
- Add snapshot tests against real fixture output
- Verify human-readable output is useful and accurate

### Success criteria

- `foxhole run --url https://example.com` prints a complete markdown report to stdout
- Report includes all required sections in the correct order
- No em dashes, no smart quotes, no AI-sounding language in output
- Snapshot test passes against the sample report fixture
- Recommendations start with a verb, metric values include units

### Relevant decisions

- ADR-002: Finding normalization (report consumes normalized findings, not raw engine output)

---

## Phase 4: Multi-URL and --build mode

**Spec:** `docs/phases/phase-4.md`
**Status:** Planned

### Objectives

- `--urls` parses and audits a comma-separated list of URLs
- `--build` starts the static server, substitutes localhost URLs, tears down after run
- `AuditReport.pages` contains one `PageResult` per audited URL
- Per-page scores and findings are correctly aggregated into the overall report

### Success criteria

- `foxhole run --urls https://example.com/login,https://example.com/dashboard --output json` produces an `AuditReport` with two entries in `pages`
- `foxhole run --build ./dist --urls /login,/dashboard` starts a local server, audits both routes, and exits cleanly
- The static server is shut down after the run regardless of success or failure
- Overall score is the average of per-page scores
- When one URL is unreachable, the resulting `AuditReport.pages` entry for that URL has `status: "errored"` with the error message in `error.message`, and the overall run continues per docs/spec/architecture.md section 6.3

### Relevant decisions

- ADR-004: Playwright wait strategy
- ADR-008: No crawling in v1

---

## Phase 5: Compare and diff

**Spec:** `docs/phases/phase-5.md`
**Status:** Planned

### Objectives

- Validate `diffReports` against real before/after audit pairs
- `foxhole compare` prints regressions, improvements, and score delta
- Markdown rendering for diff output

### Success criteria

- `foxhole compare ./before.json ./after.json` exits with code 0 and prints a diff summary
- Regressions (new findings in after) are correctly identified by finding ID
- Improvements (resolved findings in after) are correctly identified
- Score delta is correct
- Metrics delta is computed for all non-null fields
- The produced `RunDiff` includes `before_meta`, `after_meta`, and a `comparable` flag with `comparability_notes` populated when the two runs use different `perf_profile` or substantially different vendor versions, per docs/spec/schemas.md section 1.10

### Relevant decisions

- ADR-002: Stable finding IDs (required for correct regression detection)

---

## Phase 6: MCP server

**Spec:** `docs/phases/phase-6.md`
**Status:** Planned

### Objectives

- All six MCP tools wired to the live audit layer
- `foxhole mcp` starts and responds to tool calls from Claude Code
- Input validation errors surface correctly to the MCP client
- Manual verification with Claude Code for the three primary tools

### Success criteria

- `foxhole mcp` starts without errors
- `run_full_audit` called from Claude Code returns a valid `AuditReport`
- `run_accessibility_audit` returns a valid `Finding[]` for the a11y category
- `get_prioritized_fixes` accepts a serialized report and returns `Fix[]`
- Invalid input produces a structured error response, not an unhandled exception

### Relevant decisions

- ADR-006: MCP stdio transport

---

## Phase 7: CI hardening and release prep

**Spec:** `docs/phases/phase-7.md`
**Status:** Planned

### Objectives

- GitHub Actions pipeline: typecheck, lint, test on every push
- `npm run build` produces a clean `dist/` that `bin/foxhole.js` imports correctly
- `npm pack` produces the correct tarball with no extraneous files
- Version bumped to 1.0.0, changelog written, published to npm

### Success criteria

- CI passes on a clean checkout with no local state
- `npm install -g foxhole` followed by `foxhole --help` works on a machine with Node 20+
- Playwright Chromium installs correctly in the CI environment
- No files in the npm tarball that are not in the `files` array in `package.json`
- CHANGELOG.md documents all phases as a coherent release history

### Relevant decisions

- ADR-007: Monetization boundary (confirm --push is absent from the published package)

---

## Post-v1 backlog

These items are explicitly deferred. Do not build toward them without a decision to begin a new phase.

- Automatic SPA crawling (ADR-008)
- `--push` flag and hosted layer (ADR-007)
- Configurable wait buffer (currently fixed at 500ms per ADR-004)
- Per-selector finding deduplication across multiple axe violations
