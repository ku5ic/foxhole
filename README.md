# foxhole

[![CI](https://github.com/ku5ic/foxhole/actions/workflows/ci.yml/badge.svg)](https://github.com/ku5ic/foxhole/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40ku5ic%2Ffoxhole.svg)](https://www.npmjs.com/package/@ku5ic/foxhole)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Frontend audit CLI and MCP server. Dig into your frontend. Find what is hiding.

Foxhole audits any URL, local build, or SPA route list for accessibility violations, performance regressions, semantic HTML issues, and bundle problems. It wraps Lighthouse and axe-core, adds a custom semantic checker and bundle analysis, and produces scored, prioritized findings designed to be read by a developer or consumed by an AI agent.

---

## Why foxhole

**Lighthouse CI** runs Lighthouse and stores score history. It surfaces a score drop, gives you Lighthouse's own prioritized opportunities (render-blocking resources, unused JS, large payloads), and flags regressions. What it does not do is combine those performance findings with an axe-core accessibility pass, a semantic HTML check, or a cross-category ranked fix list in a single report. You still get separate signals, not one answer.

**axe-core in a test suite** gives you violation counts against the live DOM. It has no performance data, no bundle size analysis, and no narrative. Violations are raw rule IDs that require a lookup to understand, and there is no concept of severity ranking across finding types.

**Foxhole** runs both engines in one command, adds a custom semantic checker that catches issues axe-core does not (multiple h1, fake buttons without keyboard access, interactive elements without accessible text), adds network-capture bundle analysis, and produces a single scored report with findings ranked by severity and effort. A failing build tells you not just that something is wrong, but what to fix first and why. The same report is returned as structured JSON by the MCP server, so an AI agent can reason about it and act.

---

## What foxhole checks

### Performance (`perf`)

Runs Lighthouse against the target page. Reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB, TBT) alongside prioritized opportunities such as render-blocking resources, oversized images, and unused CSS.

### Accessibility (`a11y`)

Runs axe-core against the fully rendered DOM. Violations are mapped to WCAG clauses, classified by severity, and paired with specific recommendations rather than raw rule identifiers.

### Semantic HTML (`semantic`)

Inspects the DOM for structural issues: missing landmarks, improper heading hierarchy, form fields without labels, and interactive elements that should be native controls.

### Bundle (`bundle`)

Captures network responses during page load and reports:

- Total JavaScript transfer above 500 KB
- Any single JavaScript chunk above 200 KB, with framework vs. application classification (recommendations differ for each)
- Total CSS transfer above 100 KB
- Resources loaded over HTTP on an HTTPS page

Bundle analysis works against any live URL or a local build served by `--build`. No build stats file is required.

---

## Install

```bash
npm install -g @ku5ic/foxhole
npx playwright install chromium
```

On Linux, also install system dependencies:

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
  --url                Single target URL
  --urls               Comma-separated list of URLs or paths (SPA routes)
  --build              Path to a static build directory, serves on an internal port (requires --urls)
  --checks             Subset of checks to run: perf, a11y, semantic, bundle (default: all)
  --output             Output format: json | markdown (default: markdown)
  --out                File path for output (default: stdout)
  --config             Path to foxhole.config.json
  --threshold          Exit with code 1 if overall score drops below this value
  --throttling         Lighthouse throttling preset: desktop, mobile, or none (default: none)
  --concurrency        Number of URLs to audit in parallel (default: 1)
  --exclude-framework  Exclude framework JS findings from score computation
  --quiet              Suppress progress output to stderr
```

### `foxhole compare`

Diffs two saved audit results and outputs the diff as JSON. Shows regressions, improvements, and net score delta (`after.score - before.score`).

```bash
foxhole compare ./before.json ./after.json

# Gate CI on any score regression: exit 1 if score dropped
foxhole compare ./before.json ./after.json --threshold 0

# Require a minimum improvement: exit 1 if score did not rise by at least 5
foxhole compare ./before.json ./after.json --threshold 5
```

### `foxhole report`

Renders a report from a saved JSON result without re-running the audit. Output goes to stdout; use shell redirection to write to a file.

```bash
foxhole report ./audit.json
foxhole report ./audit.json --output json > ./audit-rerendered.json
```

### `foxhole init`

Creates a `foxhole.config.json` in the current directory. Prompts interactively before overwriting an existing file.

### `foxhole mcp`

Starts the MCP server over stdio. See [MCP server](#mcp-server) below.

---

## Config file

Store project settings in `foxhole.config.json`. CLI flags always take precedence over config values.

```json
{
  "url": "https://example.com",
  "urls": ["/login", "/dashboard", "/settings"],
  "checks": ["perf", "a11y", "semantic"],
  "output": "json",
  "out": "./audit.json",
  "threshold": 80,
  "throttling": "none",
  "concurrency": 1,
  "exclude_framework": false
}
```

All fields are optional. Unknown fields cause a validation error.

```bash
foxhole run --config foxhole.config.json
```

Config is also auto-discovered from the current working directory when `--config` is not set.

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

Running with `--output json` produces a structured `AuditReport` whose schema is documented in [docs/spec/schemas.md](docs/spec/schemas.md).

---

## MCP server

Foxhole exposes its audit capabilities as MCP tools callable by any MCP-compatible AI agent.

### Claude Code

Register foxhole as a user-level MCP server, available across all your projects:

```bash
claude mcp add --scope user --transport stdio foxhole -- foxhole mcp
```

For a project-scoped install shared with teammates via `.mcp.json`:

```bash
claude mcp add --scope project --transport stdio foxhole -- foxhole mcp
```

The `--` separator before `foxhole mcp` is required; without it, the `mcp` argument is misparsed as a flag.

Verify the server was added:

```bash
claude mcp list
```

Scope reference:

| Scope     | Stored in        | Visible to                     |
| --------- | ---------------- | ------------------------------ |
| `user`    | `~/.claude.json` | All your projects              |
| `project` | `.mcp.json`      | This project (commit to share) |
| `local`   | `~/.claude.json` | This project only (not in git) |

### Other MCP clients

Add the following to your MCP client's server config:

```json
{
  "mcpServers": {
    "foxhole": {
      "type": "stdio",
      "command": "foxhole",
      "args": ["mcp"]
    }
  }
}
```

### Available tools

| Tool                      | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `run_full_audit`          | Full audit against a URL or build. Returns a complete AuditReport.          |
| `run_accessibility_audit` | axe-core pass. Returns categorized violations with WCAG references.         |
| `run_performance_audit`   | Lighthouse pass. Returns CWV metrics and prioritized opportunities.         |
| `get_prioritized_fixes`   | Takes a serialized AuditReport and returns a ranked fix plan.               |
| `compare_runs`            | Diffs two AuditReports. Returns regressions, improvements, and score delta. |
| `generate_report`         | Renders an AuditReport as JSON or markdown.                                 |

The three audit tools (`run_full_audit`, `run_accessibility_audit`, `run_performance_audit`) load `foxhole.config.json` from the server's working directory on each invocation. Pass a `config` input to use a different file. Tool input takes precedence over config, which takes precedence over built-in defaults.

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

- `0` audit passed (score at or above threshold, or no threshold set)
- `1` audit completed, score below threshold
- `2` runtime error, config error, or page failed to load

Store the JSON artifact and use `foxhole compare` to gate on score regressions across runs:

```bash
foxhole compare ./previous-audit.json ./audit.json --threshold 0
```

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
- Chromium: `npx playwright install chromium` after installing foxhole (Linux also needs `npx playwright install-deps chromium`)

---

## Known limitations

- Cross-origin source maps are not fetched. Findings on bundles whose source maps live on a different origin will surface with bundled coordinates rather than original source.
- `Finding.source` is always null in this release. Source map integration is planned for a later phase.
- Lighthouse and Playwright open separate Chromium instances for each page audit. They do not share a browser. This costs one additional Chromium launch per page when both `perf` and other checks are requested.
- `--build` mode serves static files only. There is no server-side renderer and no proxy for backend API requests; pages that depend on either need to be audited against a running environment.
- Lighthouse performance scores have inherent variance from one run to the next. Run the audit twice and compare with `foxhole compare` to track score trends rather than treating a single run as definitive.
- Bundle checks (`--checks bundle`) navigate the target page a second time in a fresh browser context to capture network responses. Pages with side effects from navigation may produce inconsistent results.

---

## License

MIT
