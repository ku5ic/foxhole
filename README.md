# foxhole

Frontend audit CLI and MCP server. Dig into your frontend. Find what is hiding.

Foxhole runs a deep audit against any URL, local build, or list of SPA routes and surfaces accessibility violations, performance regressions, semantic HTML issues, and bundle problems. It wraps Lighthouse and axe-core and adds prioritized findings, effort estimates, and a narrative report that reads like it was written by a senior engineer.

Works standalone as a CLI, integrates into CI pipelines, and exposes an MCP server so AI agents can run audits directly inside your development workflow.

---

## Install

```bash
npm install -g foxhole
```

Requires Node.js 20 or later. Playwright installs Chromium automatically on first run.

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

## CI integration

Foxhole exits with a non-zero code when the audit score drops below a threshold. Use `--threshold` to enforce a minimum score in your pipeline.

```bash
foxhole run --url https://example.com --threshold 80 --output json --out ./audit.json
```

Exit codes:

- `0` audit passed, score at or above threshold
- `1` audit completed, score below threshold
- `2` runtime error, config error, or network failure

---

## MCP server

> **Note:** The `foxhole mcp` command is planned for Phase 6 and is not available in the current release. The MCP tool definitions exist in the codebase but the CLI subcommand has not been wired up yet.

Foxhole will include an MCP server that exposes audit capabilities as tools callable by any MCP-compatible AI agent, including Claude Code.

```bash
foxhole mcp
```

Available tools:

| Tool                      | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `run_full_audit`          | Full audit against a URL or build. Returns a complete AuditReport.          |
| `run_accessibility_audit` | axe-core pass. Returns categorized violations with WCAG references.         |
| `run_performance_audit`   | Lighthouse pass. Returns CWV metrics and prioritized opportunities.         |
| `get_prioritized_fixes`   | Takes a Finding array and returns a ranked fix plan with effort estimates.  |
| `compare_runs`            | Diffs two AuditReports. Returns regressions, improvements, and score delta. |
| `generate_report`         | Renders an AuditReport as markdown.                                         |

To use foxhole as an MCP server in Claude Code, add the following to your MCP config:

```json
{
  "mcpServers": {
    "foxhole": {
      "command": "foxhole",
      "args": ["mcp"]
    }
  }
}
```

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

## Output

Foxhole produces structured JSON output that both humans and AI agents can consume.

```json
{
  "version": 1,
  "score": 74,
  "summary": "The page has several accessibility issues that affect keyboard and screen reader users, and an LCP of 4.2s that will hurt search ranking on mobile. The three highest-impact fixes are outlined below.",
  "pages": [...],
  "prioritized_fixes": [
    {
      "rank": 1,
      "title": "Add alt text to 6 product images",
      "effort": "low",
      "severity": "critical",
      "category": "a11y"
    }
  ],
  "meta": {
    "foxhole_version": "1.0.0",
    "input_mode": "url",
    "duration_ms": 18400,
    "passed": false
  }
}
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
- Chromium (installed automatically by Playwright on first run)

---

## Known limitations

- Cross-origin source maps are not fetched. Findings on bundles whose source maps live on a different origin will surface with the bundled coordinates rather than the original source.
- `Finding.source` is always null in this release. Source map integration (mapping bundled coordinates back to original file and line) is planned for a later phase.
- Lighthouse and Playwright open separate Chromium instances for each page audit. They do not share a browser. This costs one additional Chromium launch per page when both `perf` and other checks are requested.
- `--build` mode serves static files only. There is no server-side renderer and no proxy for backend API requests; pages that depend on either need to be audited against a running environment.
- Lighthouse performance scores have inherent variance from one run to the next. Running the audit multiple times and comparing results is the workaround until `--perf-runs` is implemented.
- Bundle checks (`--checks bundle`) navigate the target page a second time in a fresh browser context to capture network responses. Pages with side effects from navigation may produce inconsistent results.

---

## License

MIT
