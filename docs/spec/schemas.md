# Foxhole schemas spec

Version: 1.0.0
Status: Draft, pending review
Owner: Sinisa
Last updated: 2026-04-30
Depends on: docs/spec/v1.md, docs/spec/architecture.md

This document is the canonical data contract for Foxhole v1. Every TypeScript interface, every JSON shape, every wire format used between modules is defined here. The product spec describes what Foxhole does. The architecture spec describes how it is built. This document describes the data that flows between the modules.

The shapes defined here are the public API surface for JSON output and MCP responses. Breaking changes to anything in this document increment the `version` field on `AuditReport`.

## 1. Type definitions

### 1.1 Primitives

```typescript
export type CheckCategory = "perf" | "a11y" | "semantic" | "bundle";
export type Severity = "critical" | "major" | "minor";
export type Effort = "low" | "medium" | "high";
export type CategoryStatus = "ok" | "errored" | "skipped";
export type InputMode = "url" | "urls" | "build";
```

These are the only enum-like types in the system. Every other discriminated value is a string drawn from one of these unions.

Severity has three levels, not five or seven. The temptation to add `info` or `warning` is rejected: every finding is either fix-now (`critical`), fix-soon (`major`), or fix-when-convenient (`minor`). Anything below minor does not belong in the report.

Effort has three levels matching severity. `low` is "minutes", `medium` is "an afternoon", `high` is "a sprint or more". These are author-judged values from the findings catalog, not computed.

### 1.2 SourceLocation

Added by the v1 product spec discussion. The result of source map resolution.

```typescript
export interface SourceLocation {
  file: string; // absolute path on disk in --build mode, URL in --url mode
  line: number; // 1-indexed
  column: number; // 1-indexed
  snippet: string | null; // the offending line of source, with at most 1 line of context above and below, joined with newlines. null if the file could not be read.
}
```

`file` is always absolute. The renderer is responsible for displaying it relative to a project root if the user wants that; the schema does not assume any working directory.

`snippet` is null when the file resolved but could not be read (permissions, deleted between build and audit, etc.). A successful resolution with no snippet is rare but valid.

### 1.3 Finding

```typescript
export interface Finding {
  id: string; // see section 2 for ID generation
  category: CheckCategory;
  severity: Severity;
  effort: Effort;
  rule_id: string; // catalog rule id, e.g. "a11y/color-contrast"
  title: string; // from catalog
  description: string; // from catalog, may interpolate vendor-specific values
  recommendation: string; // from catalog, hand-authored
  selector: string | null; // CSS selector for DOM-based findings, null for network-based
  wcag: string | null; // e.g. "1.4.3" for color contrast, null if not applicable
  impact: string | null; // short impact statement from vendor (axe especially), null if absent
  source: SourceLocation | null; // resolved post-runner, null if resolution failed or disabled
  url: string; // canonical URL of the page on which this finding was raised
}
```

Three additions over the v1 spec's draft schema:

1. `rule_id` is now explicit. The architecture spec requires it for catalog lookup; making it part of the schema makes it queryable from consumers.
2. `source` is the new field for source map resolution.
3. `id` is now defined as a stable hash, specified in section 2.

### 1.4 Fix

```typescript
export interface Fix {
  rank: number; // 1-based, computed
  finding_ids: string[]; // ids of findings this fix resolves
  rule_id: string; // the catalog rule id all member findings share
  title: string; // from catalog
  description: string; // from catalog
  effort: Effort; // from catalog
  severity: Severity; // worst severity across member findings
  category: CheckCategory;
  pages_affected: string[]; // unique URLs from member findings
}
```

Two changes from the v1 spec draft:

1. `rule_id` is added for the same reason as on `Finding`.
2. `pages_affected` is the denormalized view promised by the architecture spec. It is the union of `url` values from all `finding_ids`. Required for the top-fixes table in the markdown report.

A `Fix` represents a single rule that fires on one or more pages. Two findings of the same rule on different pages collapse into one fix. Two findings of different rules with similar root causes (e.g. low contrast on two different selectors) are separate fixes.

### 1.5 CategorySummary

```typescript
export interface CategorySummary {
  category: CheckCategory;
  status: CategoryStatus;
  error: { message: string } | null;
  score: number; // 0-100, integer. 0 if status is errored or skipped.
  findings_count: number; // 0 if status is errored or skipped.
  critical_count: number;
  major_count: number;
  minor_count: number;
}
```

Two changes from the v1 spec draft:

1. `status` and `error` are added per the architecture spec. This is the partial-failure semantics surfacing in the schema.
2. `error` is `null`, not `undefined`, when status is `ok` or `skipped`. JSON does not represent `undefined`; using explicit `null` makes the wire format consistent.

When status is `errored`, all numeric fields are 0 and the report consumer is expected to treat the category as having no data, not as having a perfect score.

### 1.6 PerformanceMetrics

```typescript
export interface PerformanceMetrics {
  lcp: number | null; // milliseconds
  fid: number | null; // milliseconds, null when not measurable (lab data)
  cls: number | null; // unitless, accumulated layout shift score
  fcp: number | null; // milliseconds
  ttfb: number | null; // milliseconds
  tbt: number | null; // milliseconds
  performance_score: number | null; // 0-100 from Lighthouse, null if perf check did not run
  accessibility_score: number | null; // 0-100 from Lighthouse a11y, separate from Foxhole a11y score
  bundle_size: number | null; // total transferred bytes, null if bundle check did not run
}
```

Every field is nullable because every field can be missing for a legitimate reason (the corresponding check did not run, the metric is unavailable in lab conditions, or the runner errored).

`accessibility_score` is Lighthouse's own a11y score, captured as a metric for completeness. It is not the score Foxhole computes for the `a11y` category, which is derived from finding severity and count via `audit/score.ts`. Consumers comparing the two scores should expect divergence; the rendering layer surfaces both.

`bundle_size` is transferred bytes per the v1 spec decision. Decoded and gzipped sizes are not reported. If a future version adds them, they go on a new structured `BundleBreakdown` object, not as additional top-level fields.

### 1.7 PageResult

```typescript
export interface PageResult {
  url: string;
  status: "ok" | "errored"; // page-level status, not category-level
  error: { message: string } | null;
  score: number; // 0-100, computed from category scores. 0 if status is errored.
  categories: CategorySummary[]; // always 4 entries, one per category, even if some are skipped
  findings: Finding[]; // empty array if status is errored
  metrics: PerformanceMetrics; // all-null if status is errored
  audited_at: string; // ISO 8601 timestamp
  duration_ms: number; // wall-clock time spent on this page
}
```

Three changes from the v1 spec draft:

1. `status` and `error` at the page level, mirroring CategorySummary. Required when navigation itself fails.
2. `duration_ms` is added. Useful for performance budget verification and for users debugging slow audits. Cheap to capture.
3. `categories` is always length 4, with skipped categories present as `status: "skipped"` entries. This makes consumer code simpler: "find the perf category" never returns undefined.

### 1.8 RunMeta

```typescript
export interface RunMeta {
  foxhole_version: string;
  node_version: string;
  platform: string; // process.platform + arch, e.g. "darwin-arm64"
  audited_at: string; // ISO 8601 timestamp of when the run started
  input_mode: InputMode;
  checks_run: CheckCategory[]; // categories actually executed (excludes skipped)
  page_count: number;
  duration_ms: number; // total wall-clock for the entire run
  threshold: number | null;
  passed: boolean; // true if all pages succeeded and score met threshold
  concurrency: number; // value used for this run
  perf_runs: number; // value used for this run
  perf_profile: "fast" | "standard" | "mobile";
  source_maps: "auto" | "on" | "off";
  dependencies: {
    axe_core: string; // version of axe-core used
    lighthouse: string; // version of lighthouse used
    playwright: string; // version of playwright used
  };
}
```

Two changes from the v1 spec draft:

1. `crawl_depth` removed. Crawling is deferred to v2; the field has no meaning in v1.
2. `concurrency`, `perf_runs`, `perf_profile`, `source_maps`, and `dependencies` added. The architecture spec's accuracy concerns require capturing the run configuration in the report so two reports can be meaningfully compared. A perf score from a `fast` profile is not comparable to one from a `mobile` profile, and the report must show that.

`dependencies` is the audit trail for "did this finding regress because the code regressed, or because axe got smarter". Without it, run comparison across time becomes unreliable.

### 1.9 AuditReport

```typescript
export interface AuditReport {
  version: 1; // schema version, increments on breaking change
  summary: string; // deterministic, generated by audit/summarize.ts
  score: number; // 0-100, weighted average of page scores
  pages: PageResult[];
  prioritized_fixes: Fix[];
  meta: RunMeta;
}
```

Unchanged from the v1 spec draft. The top-level shape is intentionally minimal: a version, a summary, a score, the pages, the fixes, the metadata.

The `score` field is the headline number. It is computed by averaging page scores, weighted equally. Future versions may introduce category weighting; v1 keeps it simple.

### 1.10 RunDiff

```typescript
export interface RunDiff {
  before_meta: Pick<RunMeta, "foxhole_version" | "audited_at" | "perf_profile" | "dependencies">;
  after_meta: Pick<RunMeta, "foxhole_version" | "audited_at" | "perf_profile" | "dependencies">;
  comparable: boolean; // false if the two runs cannot be meaningfully compared
  comparability_notes: string[]; // empty when comparable, populated with reasons when not
  score_delta: number; // after.score - before.score
  passed: boolean; // true if the diff meets the threshold (if any)
  regressions: Finding[]; // findings present in after, absent in before
  improvements: Finding[]; // findings present in before, absent in after
  unchanged: Finding[]; // findings present in both
  metrics_delta: Partial<PerformanceMetrics>; // per-metric delta, null entries omitted
  summary: string; // deterministic, generated by audit/diff.ts
}
```

Four changes from the v1 spec draft:

1. `before_meta` and `after_meta` are added. The diff needs to surface what configurations were compared.
2. `comparable` and `comparability_notes` are added. If perf profiles differ between the two runs, or axe versions differ significantly, the diff is suspect. The flag lets consumers decide what to do; the notes explain why.
3. `audited_at` is referenced here via `Pick` and defined in section 1.8.
4. `metrics_delta` is `Partial<PerformanceMetrics>` with null entries omitted. Only metrics that changed appear.

## 2. Finding ID generation

The architecture spec requires stable hashes for `Finding.id`. This section specifies the exact algorithm.

### 2.1 Requirements

The ID must:

1. Be stable across runs of the same finding on the same page. Otherwise `compare_runs` cannot detect that a finding persists.
2. Be insensitive to incidental DOM changes (sibling reordering, surrounding markup edits). Otherwise innocent layout changes fire false regressions.
3. Be sensitive to substantive changes (the rule firing on a different element, the underlying issue moving to a new section). Otherwise meaningful changes look like the same persisting issue.
4. Be globally unique within a single `AuditReport`. The architecture spec asks whether scope is per-page or per-report; the answer is per-report. This makes `Fix.finding_ids` straightforward to use, and matches how consumers will query.

### 2.2 Algorithm

```
finding_id = sha256(
  page_url || "\0" ||
  rule_id || "\0" ||
  semantic_path || "\0" ||
  text_fingerprint
).slice(0, 16)
```

Where:

- `page_url` is the canonical URL of the page (the `url` field of `PageResult`)
- `rule_id` is the catalog rule id (e.g. `"a11y/color-contrast"`)
- `semantic_path` is the chain of ancestor landmarks and headings from the document root to the offending element, joined by `/`. See 2.3.
- `text_fingerprint` is the first 64 characters of the finding's primary text content. See 2.4.
- `\0` is a NUL byte separator. Prevents fingerprint collisions where field boundaries are ambiguous.

The hash is truncated to 16 hex characters (64 bits). Collision probability within a single report is negligible.

### 2.3 Semantic path

For DOM-based findings (a11y, semantic), the semantic path is built by walking from the offending element up to the document root, collecting only elements that contribute structural meaning:

- Landmarks: `main`, `nav`, `header`, `footer`, `aside`, `section[aria-label]`, `section[aria-labelledby]`
- Headings: `h1` through `h6`, identified by their text content
- Forms: `form[name]` or `form[id]`

A typical path: `main/section:Pricing/h2:Plans/form:checkout`. The path is built from outermost to innermost, joined by `/`.

Elements without semantic role contribute nothing to the path. Two findings on different `<div>` siblings with the same parents and the same text fingerprint produce the same id. This is intentional: if a div is interchangeable with its siblings, the finding is morally the same.

For network-based findings (perf, bundle), the semantic path is the bundle URL or resource path. `/assets/main.js`, `/api/users`, etc.

### 2.4 Text fingerprint

The first 64 characters of the most identifying text:

- For a11y: the violation message from axe combined with a short selector tail (`color-contrast: 3.1:1 on .btn-secondary`)
- For semantic: the issue title and the offending text (`heading-skip: h2 -> h4`)
- For perf: the audit id and the offending resource (`render-blocking: /css/main.css`)
- For bundle: the rule id and the resource path (`oversized-js: /assets/main-a8f3.js`)

64 characters is enough to disambiguate within a page while staying short enough to be insensitive to trivial whitespace changes.

### 2.5 Stability across builds

The semantic path is more stable than CSS selectors but less stable than user intent. A heading rename ("Plans" to "Pricing tiers") changes the path and produces a new finding id. This is correct: the heading was renamed, the surrounding content is now in a different semantic location, and treating that as the same finding would be misleading.

A bundle hash change (`main-a8f3.js` to `main-b9c4.js`) changes the text fingerprint for bundle findings. The schema accepts this; bundle findings are inherently per-build, and a regression detector that ignores hash changes would be more confusing than helpful.

For users who want hash-insensitive bundle finding ids, that is a v2 enhancement, not a v1 concern.

## 3. JSON wire format

### 3.1 Encoding

UTF-8. Pretty-printed with 2-space indentation when written to a file. Single-line when emitted to stdout in `--quiet` mode and when returned over MCP.

### 3.2 Field ordering

JSON spec does not require ordering, but predictable ordering helps human readers and diff tools. The serializer writes fields in interface declaration order. Consumers must not rely on field order; this is a courtesy, not a contract.

### 3.3 Null vs absent

Optional fields use explicit `null`, not absence. A finding without source resolution has `"source": null`, not a missing key. This means:

- Consumers can rely on every field defined in the schema being present
- Diffs between reports do not see noise from "field added" vs "field changed to null"
- The wire format is self-describing without needing the schema to interpret missing keys

The one exception: `metrics_delta` in `RunDiff` omits null entries (only changed metrics appear). This is documented at the field level.

### 3.4 Numbers

Scores are integers, 0-100 inclusive. Time durations are milliseconds, integer. Bytes are integers. Layout shift (`cls`) is a float because it has no natural unit and Lighthouse reports it as a float.

No NaN, no Infinity. If a metric cannot be measured, the field is null.

## 4. Schema versioning

### 4.1 The version field

`AuditReport.version` is currently `1`. It increments on any breaking change to the wire format.

Breaking changes include:

- Removing or renaming a field
- Changing a field's type
- Changing the meaning of a field
- Removing a value from an enum
- Tightening validation (e.g. making an optional field required)

Non-breaking changes do not increment the version:

- Adding an optional field
- Adding a value to an enum (consumers must handle unknown enum values gracefully; this is documented)
- Loosening validation
- Documentation changes

### 4.2 Migration policy for v1.x

Within v1.x releases, the schema is additive only. Any change that would force a version bump is held until v2.

This is the contract that lets users save reports and compare across Foxhole versions for the lifetime of v1.

### 4.3 Forward compatibility for consumers

Consumers (the markdown renderer, the MCP server, third-party tooling) must:

- Ignore unknown fields silently
- Treat unknown enum values as a recognized fallback (e.g. unknown severity treated as `major`, unknown status treated as `errored`)
- Never crash on schema content they do not recognize

This is documented in the README.

## 5. Zod schemas

### 5.1 Source of truth

The TypeScript types in this document are the human-readable form. The runtime source of truth is the Zod schema in `src/types/`. TypeScript types are derived from Zod via `z.infer`, not duplicated.

This guarantees that runtime validation matches compile-time types. A field that exists in the type but not in the schema is impossible.

### 5.2 Where Zod is enforced

- Config file loading: every field validated on parse. Strict mode (no unknown keys).
- MCP tool inputs: every input validated before the tool body runs.
- `compare` and `report` commands: input JSON files validated before processing. A malformed report is rejected with a clear error.

Zod is not used to validate the orchestrator's own output. The orchestrator builds typed objects directly; running them through Zod would be redundant given TypeScript already enforces the shape at compile time.

### 5.3 Strict mode rationale

Unknown keys in config files are a hard error, not a warning. The reasoning: a typo in a config field is silently ignored otherwise, and the user spends an hour wondering why their setting is not applied. Failing fast is friendlier.

For input JSON to `compare` and `report`, strict mode is also enabled. Reports from a future Foxhole version that adds fields will fail to parse on an older Foxhole. This is acceptable: the alternative (silently ignoring fields) breaks the forward compatibility promise above. The error message points at the version mismatch.

This is the one place the architecture spec's forward compatibility rule and the strict mode rule conflict. The resolution: the markdown renderer ignores unknown fields (forward-compatible consumer), but the JSON schema validator is strict (validation surface). Both are correct for their respective contexts.

## 6. Resolutions to open questions from the architecture spec

The three open questions from section 15 of the architecture spec, resolved:

### 6.1 Should `Finding.id` be globally unique within a report, or unique only within a page?

Globally unique within a report. The hash inputs include `page_url`, so collisions across pages are not a concern, and `Fix.finding_ids` becomes a flat list of unambiguous references.

### 6.2 How are runner errors expressed at the report level when no findings exist for that category?

The category appears in `PageResult.categories` with `status: "errored"`, all counts at 0, and the error message in `error.message`. The category is always present in the array; it is never omitted.

For findings: errored runners contribute nothing to `PageResult.findings`. The error is captured at the category level, not as a synthetic finding. This keeps the findings array clean for downstream consumers.

### 6.3 What is the ID generation strategy?

Specified in section 2 above.

## 7. Type-level relationships

A few relationships worth stating explicitly because they constrain implementation:

1. Every `Finding.id` referenced in `Fix.finding_ids` must exist in some `PageResult.findings` array within the same report. The orchestrator validates this in development builds; production builds skip the check for performance.

2. `Fix.pages_affected` is the unique set of `Finding.url` values across `Fix.finding_ids`. Always derivable from the finding ids; never authored separately.

3. `PageResult.score` is computed from the scores of categories with `status: "ok"`. Errored and skipped categories are excluded from the average rather than counted as zero. This is the same rule as the run-level score in `AuditReport.score`.

4. `RunMeta.passed` is `true` if and only if every page has `status: "ok"` and `AuditReport.score >= threshold` (or no threshold is set). A single errored page makes the run not passed, even if other pages scored well.

5. `RunMeta.checks_run` reflects what was requested via `--checks` minus any categories that errored on every single page. A category that errored on some pages but succeeded on others is still in `checks_run`.

## 8. Findings catalog format

The catalog is a TypeScript module. Its shape:

```typescript
export interface CatalogEntry {
  rule_id: string; // e.g. "a11y/color-contrast"
  source: "axe" | "lighthouse" | "semantic" | "bundle";
  vendor_rule_id: string | null; // e.g. "color-contrast" for axe, null for Foxhole-native rules
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string; // may contain placeholders like {selector}, {ratio}
  description_template: string;
  recommendation: string; // hand-authored, no placeholders
}

export const catalog: Record<string, CatalogEntry>;
```

`title_template` and `description_template` use `{name}` placeholders. The runner is responsible for substitution at finding generation time.

`recommendation` is fixed text; it never interpolates. This is the rule that protects voice: a recommendation that interpolates user content can be hijacked into reading like AI prose.

The full catalog content is out of scope for this spec; it lives in its own document (`docs/spec/findings-catalog.md`) and grows phase by phase. This section locks in only the entry shape so the runner can be implemented against a stable interface.

## 9. Examples

### 9.1 A minimal AuditReport

```json
{
  "version": 1,
  "summary": "Score 67. 3 critical accessibility violations on /checkout, LCP regressed from 1.8s to 3.4s, bundle grew 240KB since last run.",
  "score": 67,
  "pages": [
    {
      "url": "https://example.com/checkout",
      "status": "ok",
      "error": null,
      "score": 69,
      "categories": [
        {
          "category": "a11y",
          "status": "ok",
          "error": null,
          "score": 72,
          "findings_count": 3,
          "critical_count": 0,
          "major_count": 2,
          "minor_count": 1
        }
      ],
      "findings": [
        {
          "id": "a3f9c2e1d4b6",
          "category": "a11y",
          "severity": "major",
          "effort": "low",
          "rule_id": "a11y/label-missing",
          "title": "Form input missing associated label",
          "description": "The card number input has no associated label.",
          "recommendation": "Add a label element with for matching the input id, or wrap the input in a label.",
          "selector": "input[placeholder='Card number']",
          "wcag": "1.3.1",
          "impact": "Screen reader users cannot identify this input.",
          "source": {
            "file": "/abs/path/src/components/CheckoutForm.tsx",
            "line": 24,
            "column": 7,
            "snippet": "      <input type=\"text\" placeholder=\"Card number\" />\n"
          },
          "url": "https://example.com/checkout"
        }
      ],
      "metrics": {
        "lcp": 2800,
        "fid": null,
        "cls": 0.02,
        "fcp": 1400,
        "ttfb": 390,
        "tbt": 340,
        "performance_score": 64,
        "accessibility_score": 88,
        "bundle_size": 521000
      },
      "audited_at": "2026-04-29T14:22:11Z",
      "duration_ms": 6200
    }
  ],
  "prioritized_fixes": [
    {
      "rank": 1,
      "finding_ids": ["a3f9c2e1d4b6"],
      "rule_id": "a11y/label-missing",
      "title": "Form input missing associated label",
      "description": "The card number input has no associated label.",
      "effort": "low",
      "severity": "major",
      "category": "a11y",
      "pages_affected": ["https://example.com/checkout"]
    }
  ],
  "meta": {
    "foxhole_version": "1.0.0",
    "node_version": "20.11.1",
    "platform": "darwin-arm64",
    "input_mode": "url",
    "checks_run": ["a11y", "perf", "semantic", "bundle"],
    "audited_at": "2026-04-29T14:22:11Z",
    "page_count": 1,
    "duration_ms": 6500,
    "threshold": 80,
    "passed": false,
    "concurrency": 1,
    "perf_runs": 1,
    "perf_profile": "standard",
    "source_maps": "auto",
    "dependencies": {
      "axe_core": "4.10.0",
      "lighthouse": "12.2.1",
      "playwright": "1.48.0"
    }
  }
}
```

### 9.2 An errored category

```json
{
  "category": "perf",
  "status": "errored",
  "error": {
    "message": "Lighthouse failed to launch: Chromium executable not found"
  },
  "score": 0,
  "findings_count": 0,
  "critical_count": 0,
  "major_count": 0,
  "minor_count": 0
}
```

The category is present in the array, the status reflects the failure, the error message is human-readable, and downstream code knows to treat this as "no data" rather than "perfect score".

## 10. Open questions

None. The schema is locked for v1.0.0 modulo additive changes per the version policy in section 4.

## 11. Change control

This document is versioned in git alongside the code. Any change here is a schema change. Additive changes (new optional fields, new enum values handled gracefully) require a clear commit message and a CHANGELOG entry. Breaking changes require an ADR, a version bump on `AuditReport.version`, and a migration note in the README.
