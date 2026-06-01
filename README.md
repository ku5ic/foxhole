# foxhole

[![CI](https://github.com/ku5ic/foxhole/actions/workflows/ci.yml/badge.svg)](https://github.com/ku5ic/foxhole/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40ku5ic%2Ffoxhole.svg)](https://www.npmjs.com/package/@ku5ic/foxhole)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Frontend audit CLI and MCP server. Dig into your frontend. Find what is hiding.

Foxhole audits any URL, local build, or SPA route list for accessibility violations, performance regressions, semantic HTML issues, and bundle problems. It wraps Lighthouse and axe-core, adds a custom semantic checker and bundle analysis, and produces scored, prioritized output that reads like a senior engineer's review.

---

## CI integration

The primary use case is a CI gate. Foxhole exits non-zero when the audit score drops below a threshold.

```yaml
- name: Install foxhole
  run: |
    npm install -g @ku5ic/foxhole
    npx playwright install chromium
    npx playwright install-deps chromium   # Linux only

- name: Audit
  run: foxhole run --url ${{ env.STAGING_URL }} --threshold 80 --output json --out audit.json

- name: Upload audit report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: foxhole-report
    path: audit.json
```

Exit codes:

- `0` audit passed, score at or above threshold
- `1` audit completed, score below threshold
- `2` runtime error, config error, or page failed to load

A non-zero exit makes the step fail. The JSON report is the artifact you upload and diff across runs. A reusable composite Action is planned post-launch.

---

## Install

```bash
npm install -g @ku5ic/foxhole
```

Then install the Chromium browser foxhole uses to audit pages:

```bash
npx playwright install chromium
```

On Linux, also install the system dependencies:

```bash
npx playwright install-deps chromium
```

Requires Node.js 20 or later.

---

## Quick start

```bash
# Audit a single URL
foxhole run --url https://example.com

# Audit multiple SPA routes
foxhole run --urls https://example.com/login,https://example.com/dashboard

# Audit a local build
foxhole run --build ./dist --urls /login,/dashboard

# Save results as JSON
foxhole run --url https://example.com --output json --out ./audit.json

# Compare two runs
foxhole compare ./before.json ./after.json

# Generate a report from a saved result
foxhole report ./audit.json

# Create a config file
foxhole init
```

---

## Commands

### `foxhole run`

Runs an audit against a URL, a list of URLs, or a local build directory.

```
Options:
  --url           Single target URL
  --urls          Comma-separated list of URLs or paths (SPA routes)
  --build         Path to a static build directory, spins up a local server (requires --urls)
  --checks        Subset of checks to run: perf, a11y, semantic, bundle (default: all)
  --output        Output format: json | markdown (default: markdown)
  --out           File path for output (default: stdout)
  --config        Path to foxhole.config.json
  --threshold     Exit with code 1 if score drops below this value (useful in CI)
  --throttling    Lighthouse throttling preset: desktop, mobile, or none (default: none)
  --concurrency   Number of URLs to audit in parallel (default: 1)
  --exclude-framework  Exclude framework JS findings from score computation
  --quiet         Suppress progress output
```

### `foxhole compare`

Diffs two saved audit results and outputs the diff as JSON. Shows regressions, improvements, and net score delta.

```bash
foxhole compare ./before.json ./after.json
```

### `foxhole report`

Renders a report from a saved JSON result without re-running the audit.

```bash
foxhole report ./audit.json
foxhole report ./audit.json --output markdown
```

### `foxhole init`

Creates a `foxhole.config.json` in the current directory.

### `foxhole mcp`

Starts the MCP server over stdio. See [MCP server](#mcp-server) below.

---

## Config file

```json
{
  "url": "https://example.com",
  "urls": ["/login", "/dashboard", "/settings"],
  "checks": ["perf", "a11y", "semantic"],
  "output": "json",
  "out": "./audit.json",
  "threshold": 80
}
```

Run with config:

```bash
foxhole run --config foxhole.config.json
```

---

## Example output

`foxhole run --url https://example.com --checks a11y,semantic`:

```
# Foxhole Audit Report

**URL:** https://example.com/
**Audited:** 2026-06-01T12:05:27.500Z
**Duration:** 1.5s

## Summary

Audited 1 page with an overall score of 82 out of 100. Found 2 issues: 0 critical, 2 major,
0 minor. This build passes the configured threshold.

## Score

**82 / 100** - Pass

## Categories

| Category       | Score | Critical | Major | Minor |
| -------------- | ----- | -------- | ----- | ----- |
| Accessibility  | 82    | 0        | 2     | 0     |
| Semantic HTML  | 100   | 0        | 0     | 0     |

## Prioritized fixes

### 1. Page must have one main landmark
**Effort:** Low | **Severity:** Major | **Category:** Accessibility
Wrap the primary content in a single <main> element.

### 2. All page content must be contained in landmarks
**Effort:** Low | **Severity:** Major | **Category:** Accessibility
Wrap all content in landmark elements such as <main>, <nav>, <header>, or <footer>.
```

The fixes are ranked by severity. Running with `--output json` produces a structured `AuditReport` whose full schema is documented in [docs/spec/schemas.md](docs/spec/schemas.md).

---

## MCP server

Foxhole exposes its audit capabilities as MCP tools callable by any MCP-compatible AI agent.

### Claude Code

Register foxhole as an MCP server:

```bash
claude mcp add foxhole foxhole mcp
```

That's it. Restart Claude Code and the six tools are available in your session.

### Other MCP clients

Add the following to your MCP client's server config:

```json
{
  "mcpServers": {
    "foxhole": {
      "command": "foxhole",
      "args": ["mcp"],
      "type": "stdio"
    }
  }
}
```

Available tools:

| Tool                      | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `run_full_audit`          | Full audit against a URL or build. Returns a complete AuditReport.          |
| `run_accessibility_audit` | axe-core pass. Returns categorized violations with WCAG references.         |
| `run_performance_audit`   | Lighthouse pass. Returns CWV metrics and prioritized opportunities.         |
| `get_prioritized_fixes`   | Takes a serialized AuditReport and returns a ranked fix plan.               |
| `compare_runs`            | Diffs two AuditReports. Returns regressions, improvements, and score delta. |
| `generate_report`         | Renders an AuditReport as markdown.                                         |

---

## What foxhole checks

### Performance (`perf`)

Runs Lighthouse against the target page and reports Core Web Vitals alongside prioritized opportunities. Metrics include LCP, FID, CLS, FCP, TTFB, and TBT.

### Accessibility (`a11y`)

Runs axe-core against the fully rendered DOM. Violations are mapped to WCAG clauses, classified by severity, and paired with specific recommendations rather than raw rule identifiers.

### Semantic HTML (`semantic`)

Inspects the DOM for structural issues: missing landmarks, improper heading hierarchy, form fields without labels, and interactive elements that should be native controls.

### Bundle (`bundle`)

Analyzes build output for oversized chunks, missing code splitting, and unoptimized dependencies. Requires `--build` mode or a build stats file.

---

## Why not Lighthouse CI or axe-core directly?

**Lighthouse CI** runs Lighthouse and stores score history. It flags a build when a score drops but gives you a raw number, not a ranked list of what to fix. You end up chasing a score rather than a specific problem.

**axe-core in a test suite** gives you violation counts but no performance data, no bundle analysis, and no narrative. Violations are raw rule IDs that require a lookup to understand.

**Foxhole** combines both engines, adds a custom semantic checker and bundle analysis, and produces a single scored report with findings ranked by severity and effort. The output is designed to be read by a developer or consumed directly by an AI agent. A failing build tells you not just that something is wrong, but what to fix first and why.

---

## SPA support

For single-page applications, pass the routes you want audited as a comma-separated list. Foxhole opens each route in a real Chromium instance, waits for the page to fully render, and audits the live DOM.

```bash
foxhole run --urls https://example.com/login,https://example.com/dashboard,https://example.com/settings
```

Combined with `--build`, you can audit a local SPA build against specific routes without a live server:

```bash
foxhole run --build ./dist --urls /login,/dashboard,/settings
```

---

## Requirements

- Node.js 20 or later
- Chromium: run `npx playwright install chromium` after installing foxhole (Linux also needs `npx playwright install-deps chromium`)

---

## Known limitations

- Cross-origin source maps are not fetched. Findings on bundles whose source maps live on a different origin will surface with the bundled coordinates rather than the original source.
- `Finding.source` is always null in this release. Source map integration is planned for a later phase.
- Lighthouse and Playwright open separate Chromium instances for each page audit. They do not share a browser. This costs one additional Chromium launch per page when both `perf` and other checks are requested.
- `--build` mode serves static files only. There is no server-side renderer and no proxy for backend API requests; pages that depend on either need to be audited against a running environment.
- Lighthouse performance scores have inherent variance from one run to the next. Run the audit twice and compare with `foxhole compare` to track score trends rather than treating a single run as definitive.
- Bundle checks (`--checks bundle`) navigate the target page a second time in a fresh browser context to capture network responses. Pages with side effects from navigation may produce inconsistent results.

---

## License

MIT
