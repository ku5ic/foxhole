# Changelog

## 1.0.6

### Patch Changes

- 0602640: Security: resolve GHSA-8988-4f7v-96qf (OpenTelemetry Core unbounded memory allocation in W3C Baggage propagation, moderate) via a package.json override pinning `@opentelemetry/core` to `^2.9.0`. The vulnerable copy was a transitive dependency of `lighthouse` -> `@sentry/node`'s bundled instrumentation, never imported by this project's own code.

## 1.0.5

### Patch Changes

- c84324a: Security: resolve GHSA-jxxr-4gwj-5jf2 (brace-expansion denial of service via large numeric range) in dev-only transitive dependencies via lockfile refresh.

## 1.0.4

### Patch Changes

- 201dae1: Internal: regenerate package-lock.json as part of the release version step, so the lockfile no longer trails package.json by one release. No runtime or API change.

## 1.0.3

### Patch Changes

- fd5cfc8: Security: resolve nine advisories in transitive dependencies (hono, vite, ws, js-yaml) via dependency updates. Highest severity: GHSA-96hv-2xvq-fx4p (ws denial of service), GHSA-88fw-hqm2-52qc (hono), and GHSA-fx2h-pf6j-xcff (vite), all high. GHSA-8988-4f7v-96qf (@opentelemetry/core) remains open: no fix is reachable under lighthouse's pinned @sentry/node v9 line.

## 1.0.2

### Patch Changes

- e0aa91b: Security: resolve GHSA-58qx-3vcg-4xpx (ws uninitialized memory disclosure) and GHSA-g7r4-m6w7-qqqr (esbuild network exposure) via dependency updates.

## 1.0.1

### Patch Changes

- ebb44d4: Config-aware run and MCP audit tools now auto-discover `foxhole.config.json` from the current directory without a `--config` flag; CLI flags override config values. `foxhole compare --threshold <n>` exits with code 1 when `score_delta` falls below the threshold, enabling CI regression gating. Documentation corrected to match the actual CLI surface.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-01

First stable release.

### Commands

- `foxhole run` -- audit one or more URLs or a local build directory
- `foxhole compare` -- diff two saved audit reports, surface regressions and improvements
- `foxhole report` -- re-render a saved JSON report as markdown without re-running the audit
- `foxhole init` -- generate a `foxhole.config.json` scaffold in the current directory
- `foxhole mcp` -- start the MCP server over stdio

### Checks

- `perf` -- Lighthouse audit; reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB, TBT) and prioritized opportunities
- `a11y` -- axe-core audit; violations mapped to WCAG clauses, classified by severity, paired with recommendations
- `semantic` -- custom DOM walker; heading order, landmark misuse, unlabelled inputs, generic link text, decorative image alt
- `bundle` -- network capture during page load; reports total JS transfer size, oversized chunks, mixed-content resources, and framework vs. application JS classification

### Input modes

- `--url` -- single URL
- `--urls` -- comma-separated list of URLs or paths (SPA routes)
- `--build --urls` -- local static build directory served on an ephemeral port; paths resolved against the local server

### Output

- Markdown (default) -- human-readable report with scored categories, ranked fix list, and run metadata footer
- JSON (`--output json`) -- structured `AuditReport` conforming to the v1 schema in `docs/spec/schemas.md`

### CLI flags

- `--threshold N` -- exit 1 if the overall score is below N; omit for score-only output
- `--throttling` -- Lighthouse throttling preset: `desktop`, `mobile`, or `none` (default: `none`)
- `--concurrency N` -- audit N URLs in parallel (default: 1; perf scores are noisier above 1)
- `--exclude-framework` -- exclude framework-classified JS findings from score computation
- `--quiet` -- suppress progress output to stderr

### Exit codes

- `0` -- audit completed, score at or above threshold (or no threshold set)
- `1` -- audit completed, score below threshold
- `2` -- runtime error: page failed to load, browser not installed, invalid config

### MCP tools

All six tools share the same audit layer as the CLI:

- `run_full_audit` -- full audit against one or more URLs; returns a complete `AuditReport`
- `run_accessibility_audit` -- axe-core pass only; returns `Finding[]` for the a11y category
- `run_performance_audit` -- Lighthouse pass only; returns metrics and perf findings
- `get_prioritized_fixes` -- accepts a serialized `AuditReport` JSON string; returns ranked `Fix[]`
- `compare_runs` -- diffs two `AuditReport` values; returns a `RunDiff`
- `generate_report` -- renders an `AuditReport` as markdown

### Schema

`AuditReport` v1 with stable finding IDs (sha256 of page URL, rule ID, semantic path, and text fingerprint). `RunMeta` includes `run_id`, `project_id`, `commit_sha`, and `branch` fields; all emit as `null` in this release and are reserved for the hosted tier.

### Known scope boundaries

- `Finding.source` is always `null`. Source map integration (mapping bundled coordinates back to original file and line) is deferred.
- Lighthouse and Playwright open separate Chromium instances per page. Sharing a single Chrome process is a known deferred item.
- No crawling. URLs are provided explicitly via `--url`, `--urls`, or `--build --urls`.
- No hosted layer, no `--push` flag, no LLM-generated narrative.
