# Phase 1: Schema sync, catalog foundation, and core runners

**Status:** Complete
**Depends on:** Phase 0 (foundation hardening complete, all checks green)
**Blocks:** Phase 2 (audit-layer validation cannot be done against drifted types and stub findings)

---

## 1. Summary

Close three bodies of work in one phase, in order:

1. Sync `src/types/index.ts` with `docs/spec/schemas.md`. Move the runtime source of truth into Zod, derive types via `z.infer`. No drift after this phase.
2. Stand up the findings catalog at `src/catalog/`. The catalog is the authored content layer that runners look up severity, effort, titles, descriptions, recommendations, and WCAG mappings from.
3. Replace the stub-quality runner output with normalized findings backed by the catalog and stable hash IDs per schemas spec section 2. Enforce the length-4 categories invariant.

The headline acceptance gate is unchanged from `PHASES.md`: a user can run `foxhole run --url https://example.com` (default checks: all four) end to end. Output is a valid `AuditReport`, exits 0 or 1 by threshold, every category in `PageResult.categories` is `ok`, `errored`, or `skipped` (never absent, never crashes the run).

Source-map resolution stays out. `Finding.source` is in the schema, populated by the runner as `null` for every finding. Lighthouse-Playwright unification stays as logged debt; Lighthouse keeps spawning its own Chrome via the `lighthouse(url, ...)` programmatic API. Both are explicitly named here so the next phase author does not have to rediscover the boundary.

CLI flag plumbing for `--concurrency`, `--perf-runs`, `--perf-profile`, `--wait-for`, `--wait-timeout`, `--source-maps` is also out of scope. The corresponding `RunMeta` fields are populated from defaults. Adding these flags is a separate phase covering CLI and config-file surface expansion.

---

## 2. Files

### Created

- `src/types/schema.ts`: Zod schemas for every type defined in schemas spec sections 1.1-1.10 and 1.2 (`SourceLocation`). The runtime source of truth.
- `src/catalog/index.ts`: exports `catalog: Record<string, CatalogEntry>` and the `CatalogEntry` interface, by merging the four per-source modules below.
- `src/catalog/axe.ts`: seed catalog for axe rules. Approximately 25 entries covering the most common axe rule IDs.
- `src/catalog/lighthouse.ts`: seed catalog for Lighthouse audits. Approximately 12 entries covering the most common opportunities.
- `src/catalog/semantic.ts`: full catalog for the seven existing semantic checks. Content is relocated from `src/runner/semantic.ts`.
- `src/catalog/bundle.ts`: full catalog for the four existing bundle rules. Content is relocated from `src/runner/bundle.ts`.
- `src/runner/finding-id.ts`: `computeFindingId(input): string`. The 16-hex-char hash function per schemas spec section 2.2 with the semantic-path and text-fingerprint helpers.
- `tests/catalog/index.test.ts`: structural tests asserting every catalog entry has the required fields and that severity, effort, source, and category values are valid.
- `tests/runner/finding-id.test.ts`: tests for the hash function, including the stability requirement (same inputs produce same output across runs) and the sensitivity requirement (different rule IDs produce different IDs, different page URLs produce different IDs).
- `tests/runner/axe.test.ts`: tests for axe normalization, severity mapping, WCAG extraction, selector sanitization, and catalog fallback.
- `tests/runner/lighthouse.test.ts`: tests for Lighthouse normalization, severity mapping from score buckets, metric extraction, and catalog fallback.
- `tests/runner/semantic.test.ts`: tests covering each of the seven semantic checks against fixture HTML.
- `tests/runner/bundle.test.ts`: tests for the four bundle rules with fixture network responses.
- `tests/types/schema.test.ts`: round-trip tests asserting representative valid objects parse and invalid objects fail with helpful errors.
- `tests/fixtures/axe-raw.json`: captured raw axe-core output for normalization tests.
- `tests/fixtures/lighthouse-raw.json`: trimmed raw Lighthouse output for normalization tests.
- `tests/fixtures/static/spa.html`: HTML fixture with several semantic violations and bundle anti-patterns to drive the semantic and bundle runner tests.
- `docs/spec/findings-catalog.md`: short authoring guide. Defines the entry shape, the recommendation tone, and the catalog-gap fallback rules per ADR-002.

### Modified

- `src/types/index.ts`: rewritten to re-export the types from `src/types/schema.ts` via `z.infer`. Hand-written interfaces are removed.
- `src/runner/axe.ts`: replace the inline severity map and ad-hoc selector handling with a call into the catalog. Replace the `a11y-${violation.id}` ID with `computeFindingId(...)`. Map violation nodes to per-node findings with stable IDs.
- `src/runner/lighthouse.ts`: replace the inline mapping and `perf-${audit.id}` ID with catalog lookup and `computeFindingId(...)`. Drop the silent `score < 0.9` filter; align with the schemas spec section 1.3 rule that passing audits do not become findings.
- `src/runner/semantic.ts`: remove the inline `severityForCheck`, `titleForCheck`, `recommendationForCheck` helpers. Replace with catalog lookup. Replace `semantic-${check}` IDs with `computeFindingId(...)`.
- `src/runner/bundle.ts`: replace inline finding construction with catalog lookup. Replace static IDs with `computeFindingId(...)`. Sanitize URLs in the text fingerprint input.
- `src/runner/index.ts`: catch runner errors per check (not per page) so a single runner crash produces an `errored` `CategorySummary` while the rest of the page completes. Page-level `errored` is reserved for navigation failures. Capture per-page `duration_ms`.
- `src/audit/score.ts`: enforce the length-4 categories invariant. Skipped categories (not requested by `--checks`) get `status: "skipped"`. Errored categories preserve the `errored` status from the runner layer. Run-level and page-level scores exclude `errored` and `skipped` categories from the average per architecture spec section 6.3.
- `src/audit/index.ts`: populate the new `RunMeta` fields (`audited_at`, `page_count`, `concurrency`, `perf_runs`, `perf_profile`, `source_maps`, `dependencies`) from defaults. Remove `crawl_depth`. Populate `PageResult.duration_ms` (already captured by the runner). Read dependency versions from `package.json` of the running install.
- `src/audit/prioritize.ts`: group by `rule_id` (not `category:severity`). One `Fix` per rule. `pages_affected` is the unique set of `Finding.url` values across `finding_ids`. Sort by worst severity, then by `finding_ids.length`, then by `rule_id` for stable order. Pull `title` and `description` from the catalog.
- `src/audit/diff.ts`: populate `before_meta`, `after_meta`, `comparable`, and `comparability_notes`. `comparable` is `false` when `perf_profile` differs or when major versions of `dependencies.axe_core` or `dependencies.lighthouse` differ. Notes describe each reason.
- `src/config/schema.ts`: no field additions in this phase. The schema is left at its current shape because expanding the config surface is out of scope. A `// TODO(phase-N)` comment cross-references the deferred work.
- `src/audit/summarize.ts`: account for skipped and errored categories in the summary text. Phrasing remains deterministic, no AI tells.
- `src/report/markdown.ts`: handle `Finding.source` being `null` for every finding (it always will be in this phase). Handle `errored` and `skipped` categories in the per-page section. Pull fix titles from the catalog.
- `tests/fixtures/sample-report.json`: regenerated to match the new schema. Contains `rule_id` on findings and fixes, `source: null` on every finding, the new `RunMeta` fields, length-4 categories with one `skipped` entry to demonstrate the invariant.
- `tests/fixtures/sample-diff.json`: regenerated with `before_meta`, `after_meta`, `comparable: true`, empty `comparability_notes`.
- `tests/audit/score.test.ts`: updated to the new schema and to assert the length-4 invariant, including the skipped path.
- `tests/audit/diff.test.ts`: updated to the new schema. Adds tests for `comparable: false` paths.
- `tests/cli/run.test.ts`: updated `makeReport` factory to the new `RunMeta` shape.
- `tests/runner/index.test.ts`: updated to assert per-category error isolation (a11y errors, semantic still runs, page status remains `ok`).
- `tests/runner/browser.test.ts`: no schema change, but updated if any imports moved.
- `CLAUDE.md`: add `src/catalog/` to the repository map. Add a one-line entry under the Skills table for the catalog area.
- `PHASES.md`: update the Phase 1 entry to reflect the expanded scope. Include source-maps and Lighthouse unification as named, deferred items in the Relevant decisions section.
- `README.md`: under Known limitations, add bullets for Lighthouse spawning a separate Chrome (deferred), source-map resolution not implemented in v1.0.0 (deferred), and CLI flags from v1 spec section 5.2 not yet plumbed (deferred).

### Not touched

- `src/server/static.ts`: no changes. The server lifecycle is correct after Phase 0.
- `src/mcp/`: no changes. MCP wiring is verified in Phase 6.
- `src/cli/commands/compare.ts`, `report.ts`, `init.ts`: no changes. Compare and report layer changes belong to Phases 3 and 5.
- `bin/foxhole.js`: no changes.
- ADRs: no new ADRs. ADR-002 already references schemas spec sections 1.3 and 2; ADR-005 already notes its own supersession.

---

## 3. Implementation steps

Steps are ordered. Earlier steps unblock later steps. Do not reorder.

### Step 1: Zod schema as source of truth

Create `src/types/schema.ts`. Define one Zod schema per type in schemas spec sections 1.1-1.10:

- `severitySchema`, `effortSchema`, `checkCategorySchema`, `categoryStatusSchema`, `inputModeSchema` as enums
- `sourceLocationSchema`
- `findingSchema` with `rule_id`, `source: sourceLocationSchema.nullable()`
- `fixSchema` with `rule_id`, `pages_affected: z.array(z.string())`
- `categorySummarySchema` (already mostly correct in the hand-written types, port to Zod)
- `performanceMetricsSchema`
- `pageResultSchema` with `duration_ms`
- `runMetaSchema` with all eight new fields and without `crawl_depth`
- `auditReportSchema`
- `runDiffSchema` with `before_meta`, `after_meta`, `comparable`, `comparability_notes`

Set `.strict()` on every object schema where the schemas spec section 5.3 calls for strict validation. `AuditReport`, `PageResult`, `RunMeta`, `RunDiff` are strict. The `Partial<PerformanceMetrics>` in `metrics_delta` is not strict because it is partial by definition.

Rewrite `src/types/index.ts` to consist entirely of `z.infer` re-exports plus the schema imports needed by callers that perform runtime validation. There are no hand-written interfaces in this file after this step.

Run `npm run typecheck`. Fix every callsite that depended on the old `crawl_depth` field, the old `Finding` shape, the old `Fix` shape, and the old `RunMeta` shape. The compiler is the authoritative checklist for this step.

Acceptance for this step alone: `npm run typecheck` passes. Tests will not pass yet because fixtures and factories are still on the old shape; that is the next step.

### Step 2: Update fixtures and test factories

In test files, every `makeFinding`, `makeReport`, `makeFix`, `basePage` factory needs the new fields. Concretely:

- Add `rule_id: "a11y/test"` (or similar) to every `makeFinding` factory.
- Add `source: null` to every `makeFinding` factory.
- Add `rule_id: "a11y/test"` and `pages_affected: ["https://example.com"]` to every `makeFix` factory.
- Add `duration_ms: 0` to every `makePageResult` / `basePage` factory.
- Replace every `makeReport` `meta` block with the new `RunMeta` shape: drop `crawl_depth`, add `audited_at`, `page_count`, `concurrency: 1`, `perf_runs: 1`, `perf_profile: "none"`, `source_maps: "auto"`, `dependencies: { axe_core: "0.0.0", lighthouse: "0.0.0", playwright: "0.0.0" }`.

Rewrite `tests/fixtures/sample-report.json` and `tests/fixtures/sample-diff.json` to the new shape. Use realistic content; these fixtures drive the markdown snapshot tests in Phase 3 and the diff tests today.

In `sample-report.json`, include exactly one `skipped` entry in `pages[0].categories` to demonstrate the length-4 invariant. The `meta.checks_run` array must omit the skipped category so the `RunMeta.checks_run` invariant in schemas spec section 7 holds.

Acceptance for this step: `npm run test` passes against the schema-drifted runner code. Runner tests still assert old-shape findings; that changes in step 7. The point of this step is to land schema sync without breaking anything that does not need to break.

### Step 3: Findings catalog scaffolding

Create `src/catalog/index.ts`. Define the `CatalogEntry` interface per schemas spec section 8:

```typescript
interface CatalogEntry {
  rule_id: string;
  source: "axe" | "lighthouse" | "semantic" | "bundle";
  vendor_rule_id: string | null;
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string;
  description_template: string;
  recommendation: string;
}
```

Export `catalog: Record<string, CatalogEntry>` built by spreading the four per-source modules.

Create the four per-source modules. Each exports a `Record<string, CatalogEntry>` keyed by `rule_id`. Initial scope:

- `src/catalog/semantic.ts`: seven entries, one per existing semantic check. The `recommendation` strings are lifted verbatim from the current `recommendationForCheck` switch in `src/runner/semantic.ts`. Author the `description_template` strings to match the current detail strings, with `{detail}` placeholders where appropriate.
- `src/catalog/bundle.ts`: four entries, one per existing bundle rule (`bundle/total-js-size`, `bundle/large-javascript-chunk`, `bundle/total-css-size`, `bundle/insecure-resource`). Recommendations and descriptions lifted from the current inline strings.
- `src/catalog/axe.ts`: approximately 25 entries for the most common axe rules. Required entries: `color-contrast`, `image-alt`, `label`, `link-name`, `button-name`, `landmark-one-main`, `region`, `heading-order`, `html-has-lang`, `html-lang-valid`, `document-title`, `duplicate-id`, `frame-title`, `input-button-name`, `input-image-alt`, `meta-viewport`, `select-name`, `tabindex`, `valid-lang`, `aria-roles`, `aria-required-attr`, `aria-allowed-attr`, `nested-interactive`, `role-img-alt`, `td-headers-attr`. Map rule_id format: `a11y/{vendor-rule-id}`. WCAG values per axe-core's documentation, normalized to the format from schemas spec section 2.4.
- `src/catalog/lighthouse.ts`: approximately 12 entries for the most common opportunities. Required entries: `render-blocking-resources`, `unused-css-rules`, `unused-javascript`, `largest-contentful-paint-element`, `uses-text-compression`, `uses-responsive-images`, `unminified-css`, `unminified-javascript`, `efficient-animated-content`, `uses-optimized-images`, `modern-image-formats`, `total-byte-weight`. Map rule_id format: `perf/{vendor-audit-id}`.

The recommendation strings must follow the rules in `.claude/skills/finding-normalization/SKILL.md`: actionable, start with a verb, plain ASCII punctuation, no AI tells. Review every string before committing. This is content authorship, not boilerplate.

Add `tests/catalog/index.test.ts`:

- Every entry has all required fields populated (no empty strings, no nulls in non-nullable positions)
- Every `default_severity` is one of `critical`, `major`, `minor`
- Every `default_effort` is one of `low`, `medium`, `high`
- Every `source` matches the file it is defined in (`axe.ts` entries all have `source: "axe"`, etc.)
- Every `category` is consistent with `source` (`axe` and `semantic` entries are `a11y` or `semantic`, `lighthouse` entries are `perf`, `bundle` entries are `bundle`)
- No two entries share the same `rule_id`
- Every recommendation string is at least 20 characters and contains no em dashes, no smart quotes, no banned phrases ("certainly", "great", "let's dive in", etc.)

Acceptance for this step: `npm run typecheck` passes, `npm run test` passes including the new catalog tests, and a manual `cat src/catalog/axe.ts | wc -l` confirms the seed entries are all present.

### Step 4: Stable finding ID generation

Create `src/runner/finding-id.ts`. Implement per schemas spec section 2.2:

```typescript
function computeFindingId(input: {
  pageUrl: string;
  ruleId: string;
  semanticPath: string;
  textFingerprint: string;
}): string;
```

Use `crypto.createHash("sha256")` from `node:crypto`. Concatenate fields with `\0` separators per spec. Truncate to 16 hex characters.

Add helper functions, all exported (so runners and tests can reuse them):

- `buildSemanticPath(html: string): string`: parses an outerHTML string and walks ancestors per schemas spec section 2.3. Returns the `/`-joined path. Bundle and perf findings use the bundle URL or resource path directly; this helper is for DOM findings only. The implementation may live in the runner itself if simpler; the schemas spec is silent on where the parsing happens.
- `buildTextFingerprint(input: { ruleId: string; detail: string }): string`: returns the first 64 characters of the most identifying text per schemas spec section 2.4.

The semantic path implementation has a structural choice: parse the page's DOM via Playwright at finding-construction time (correct, slower), or have each runner pass an outerHTML snippet captured during the runner pass (simpler, what axe gives us anyway). Use the outerHTML approach. axe already returns `node.html`, semantic checks already have `el.outerHTML` available, bundle has the resource URL. No additional Playwright round-trip needed.

For an axe finding on `<input>` inside `<form>`, the path looks like `main/form/input`. Edge cases:

- Document root with no landmarks: path is the empty string. Hash still works because `\0` separators make this unambiguous.
- Multiple matching landmarks of the same type (two `<section>` with `aria-label`): include the label, e.g. `section:Pricing`.
- For bundle findings: the path is the resource URL with the origin stripped, e.g. `/assets/main-a8f3.js`. Do not include hash segments in normalization for v1; bundle finding IDs intentionally change when bundle hashes change, per schemas spec section 2.5.

Add `tests/runner/finding-id.test.ts`:

- Same inputs produce same output across multiple calls (stability)
- Different rule IDs produce different IDs
- Different page URLs produce different IDs
- Different semantic paths produce different IDs
- Different text fingerprints produce different IDs
- Whitespace differences in text fingerprint produce different IDs (we do not normalize, intentionally; it is up to the runner to normalize the input)
- Output is exactly 16 hex characters
- Output is lowercase hex

Acceptance: tests pass, `npm run typecheck` passes.

### Step 5: Refactor axe runner

In `src/runner/axe.ts`:

- Remove `mapAxeImpactToSeverity`, `extractWcag`, the inline title/description/recommendation construction.
- Add a catalog lookup: `catalog[ruleId]` where `ruleId = "a11y/" + violation.id`.
- If the entry exists, use `default_severity`, `default_effort`, `wcag`, `title_template`, `description_template`, `recommendation` from the catalog. Render templates with the violation context (axe `help`, `description`, node selector text).
- If the entry does not exist, fall through to the runtime fallback per ADR-002:
  - Map axe `impact` to severity using the existing `SEVERITY_MAP` (preserve the current logic; the catalog is additive).
  - Use `axe.help` as the title and `axe.description` as the description.
  - Use a generic recommendation: `"Review this issue using axe-core documentation: " + violation.helpUrl`.
  - Set `default_effort` to `"medium"`.
  - Emit a debug-level catalog gap warning to stderr if `process.env.FOXHOLE_DEBUG === "1"`. Log line format: `[foxhole:debug] catalog gap: ruleId=a11y/{vendorId}`.
- Compute the finding ID per step 4. Inputs:
  - `pageUrl`: the URL passed to `runAxe`
  - `ruleId`: `"a11y/" + violation.id`
  - `semanticPath`: built from the node's outerHTML
  - `textFingerprint`: first 64 chars of `violation.id + ": " + node.target[0]` (matches schemas spec section 2.4 example for a11y)
- Set `source: null`. Always.
- Set `wcag` from the catalog, falling back to the existing `extractWcag(tags)` if the catalog entry is missing. WCAG mapping is one of the few fields where vendor data is more current than the catalog.
- Selector handling stays: `sanitizeSelector(node.target[0])`. The 200-char truncation rule from the finding-normalization skill is preserved.

Add `tests/runner/axe.test.ts`:

- A violation with a catalogued rule produces a Finding with catalog severity and recommendation
- A violation with a non-catalogued rule produces a Finding with vendor-impact severity and the generic recommendation
- An axe violation with multiple nodes produces multiple Findings with distinct IDs
- The same violation on the same page across two calls produces the same ID (stability)
- WCAG extraction works for `wcag2aa`, `wcag111`, etc. tags
- Selector truncation works for selectors over 200 characters
- The catalog gap path is exercised when `FOXHOLE_DEBUG=1` and a non-catalogued rule fires

Use `tests/fixtures/axe-raw.json` for the input. Create the fixture from a real axe run against `tests/fixtures/static/spa.html`; capture once, commit. Do not re-capture on every test run.

Acceptance: `npm run test` passes, including these new tests.

### Step 6: Refactor lighthouse runner

In `src/runner/lighthouse.ts`:

- Remove `mapLighthouseScoreToSeverity` and the inline `mapAuditToFinding`.
- Add a catalog lookup: `catalog["perf/" + audit.id]`.
- If the entry exists, use catalog content. Severity falls through to `default_severity` from the catalog, not from the score; the catalog is the source of truth.
- If the entry does not exist, fall through to the runtime fallback:
  - Score under 0.5 maps to `critical`, 0.5-0.89 maps to `major`, score >= 0.9 produces no finding (consistent with the finding-normalization skill).
  - Use `audit.title` as title, `audit.description` as description, generic recommendation.
  - Catalog gap warning per step 5.
- Compute the finding ID:
  - `pageUrl`: the URL passed to `runLighthouse`
  - `ruleId`: `"perf/" + audit.id`
  - `semanticPath`: for Lighthouse audits that report a specific resource (e.g. `largest-contentful-paint-element`), the resource URL with origin stripped. For audits without a specific artifact, the empty string.
  - `textFingerprint`: first 64 chars of `audit.id + ": " + (resource URL or audit.displayValue or audit.title)`
- Set `source: null`.
- Drop the silent `score < 0.9` filter from the current code. Replace with explicit branches: `score === null` is always a finding (diagnostics), `score < 0.5` is always a finding (catalog or fallback critical), `score 0.5-0.89` is always a finding (catalog or fallback major), `score >= 0.9` is never a finding.
- Skip the existing TODO comment about Lighthouse spawning its own Chrome. Leave the code spawning a separate Chrome. Add a clearer comment that the unification is logged debt with a cross-reference to architecture spec section 13.4.
- Bundle size remains pulled from the bundle runner, not from Lighthouse. Lighthouse reports `total-byte-weight` as a finding (catalogued) but `bundle_size` in `PerformanceMetrics` continues to come from the bundle runner per schemas spec section 1.6 phrasing "transferred bytes".

Add `tests/runner/lighthouse.test.ts`:

- A catalogued audit with score 0.4 produces a critical Finding
- A catalogued audit with score 0.85 produces a major Finding
- An audit with score 0.95 produces no Finding
- A non-catalogued audit goes through the fallback severity mapping
- Metrics extraction populates LCP, FCP, CLS, TTFB, TBT, performance_score, accessibility_score from a representative Lighthouse output
- Stable ID across two calls for the same audit

Use `tests/fixtures/lighthouse-raw.json`. Capture once from a real Lighthouse run against the static fixture, commit.

Acceptance: tests pass.

### Step 7: Refactor semantic runner

In `src/runner/semantic.ts`:

- Remove `severityForCheck`, `titleForCheck`, `recommendationForCheck`. Replace each with a catalog lookup keyed by `"semantic/" + check`.
- Compute the finding ID:
  - `pageUrl`: the URL passed to `runSemanticChecks`
  - `ruleId`: `"semantic/" + check`
  - `semanticPath`: for issues with a specific element selector, build from the element's outerHTML (returned from the page evaluation alongside the existing selector and detail strings; this requires expanding the `SEMANTIC_CHECKS_SCRIPT` to capture `el.outerHTML` per issue)
  - `textFingerprint`: first 64 chars of `check + ": " + detail`
- Set `source: null`.
- The `SEMANTIC_CHECKS_SCRIPT` change: add `outerHTML: el.outerHTML.slice(0, 500)` to each issue object. Truncate to 500 characters before sending across the Playwright bridge to bound transport size.

Add `tests/runner/semantic.test.ts`:

- One test per check (seven tests) using fixture HTML that triggers the rule
- Stable IDs across two calls
- Each check pulls its title, description, and recommendation from the catalog

Use `tests/fixtures/static/spa.html` as the page fixture. The HTML deliberately contains:

- No `<h1>` (triggers `missing-h1`)
- A skipped heading level (h1 to h3) (triggers `skipped-heading-level`)
- A `<button>` with empty text (triggers `interactive-no-text`)
- An `<input>` without label (triggers `input-no-label`)
- An `<img>` without alt (triggers `img-no-alt`)
- A `<div role="button">` without tabindex (triggers `fake-button-no-keyboard`)

The seventh check (`multiple-h1`) needs a different fixture because it cannot coexist with `missing-h1`. Add `tests/fixtures/static/multiple-h1.html` for that single test. Document this in a comment so the next reader does not wonder.

Acceptance: tests pass.

### Step 8: Refactor bundle runner

In `src/runner/bundle.ts`:

- Replace the inline `findings.push(...)` calls with construction via catalog lookup. Keys: `bundle/total-js-size`, `bundle/large-javascript-chunk`, `bundle/total-css-size`, `bundle/insecure-resource`.
- Compute IDs:
  - `pageUrl`: the URL passed in
  - `ruleId`: catalog key
  - `semanticPath`: for total-size findings, the empty string (no specific resource). For per-resource findings (`large-javascript-chunk`, `insecure-resource`), the resource URL with origin stripped.
  - `textFingerprint`: first 64 chars of `ruleId + ": " + (resource URL or formatted size)`
- Set `source: null`.
- Sanitize resource URLs in finding descriptions per the security skill: strip query strings, truncate paths over 200 characters. Do not log or render raw user-controlled URLs without sanitization.

Add `tests/runner/bundle.test.ts`:

- Total-JS-over-threshold produces a finding when the threshold is exceeded
- Large-JS-chunk produces one finding per oversized resource
- Total-CSS-over-threshold fires correctly
- Insecure-HTTP fires for `http://` resources (excluding `localhost`)
- All four use stable IDs

Mock the Playwright `page.on("response", ...)` handler in tests. Drive the test by calling the response handler with synthetic response objects.

Acceptance: tests pass.

### Step 9: Per-category error isolation in the runner orchestrator

In `src/runner/index.ts`:

- Today, the per-page try/catch wraps the entire per-page block. Move it inward: each runner call (`runAxe`, `runLighthouse`, `runSemanticChecks`, `runBundleChecks`) is wrapped in its own try/catch.
- On a per-runner failure, build an `errored` `CategorySummary` for that category and continue to the next runner. The page's overall status remains `ok` if at least one runner succeeded. Page-level status only becomes `errored` when navigation itself fails (the existing outer try/catch around `page.goto`).
- Capture per-page `duration_ms` (`Date.now() - pageStartTime`).
- The function still returns `PageResult[]`. Per-category errors are now visible in `categories[].error.message`, not in `PageResult.error`.

Update `tests/runner/index.test.ts`:

- One runner failing produces an `errored` category, the page status stays `ok`, the other three categories are present (`ok`, `errored`, or `skipped` per request)
- Navigation failure (mock `page.goto` to throw) produces a page-level `errored` status with all four categories `errored`
- `duration_ms` is populated and is a non-negative integer

Acceptance: tests pass. The `runAudit` shape contract holds: one `PageResult` per input URL, length-4 `categories` on every result.

### Step 10: Length-4 categories invariant in score.ts

In `src/audit/score.ts`:

- `scorePage` currently only emits categories that have findings. Change it to always emit four entries.
- Inputs to `scorePage` change: it needs to know which checks were _requested_ so it can mark non-requested categories as `skipped`. Pass the requested checks down from `audit/index.ts` as a second argument.
- For each of the four `CheckCategory` values:
  - If the page already has an `errored` category for that check (from step 9), preserve it as is.
  - Else if the check was requested and findings exist for it, build an `ok` summary.
  - Else if the check was requested and zero findings exist for it, build an `ok` summary with zero counts (this is the empty-but-ran case).
  - Else (the check was not requested), build a `skipped` summary with zero counts and `score: 0`.
- Per architecture spec section 6.3 and schemas spec section 7, the page-level `score` is computed from `ok` categories only. `errored` and `skipped` are excluded from the average. If every category is errored or skipped, the page score is 0.
- Run-level `score` (in `scoreReport`) is the average of `ok`-status pages only. Pages with status `errored` are excluded. If every page errored, the run score is 0.

Update `tests/audit/score.test.ts`:

- A page with two `ok` categories and two `skipped` produces a length-4 `categories` array
- An errored category preserves its status through `scorePage`
- The page score excludes errored and skipped categories from the average
- The run score excludes errored pages from the average
- All-errored or all-skipped pages return score 0

Acceptance: tests pass.

### Step 11: Audit orchestrator metadata population

In `src/audit/index.ts`:

- Read the dependency versions for `axe-core`, `lighthouse`, `playwright` from `node_modules/{name}/package.json`. Fail loud if any are missing (a missing dependency means the install is broken; this is the right place to surface it).
- Build the new `RunMeta` shape:
  - `audited_at`: ISO timestamp at orchestrator entry
  - `page_count`: `pages.length`
  - `concurrency`: `1` (default; CLI flag wiring deferred)
  - `perf_runs`: `1` (default; CLI flag wiring deferred)
  - `perf_profile`: `"none"` (default; CLI flag wiring deferred)
  - `source_maps`: `"auto"` (default; CLI flag wiring deferred)
  - `dependencies`: `{ axe_core, lighthouse, playwright }` from package.json reads above
  - `platform`: `${process.platform}-${process.arch}` per schemas spec section 1.8 (currently just `process.platform`)
- Drop `crawl_depth` from the meta block.
- Pass requested checks into `scorePage` per step 10.
- Compute `RunMeta.checks_run` per schemas spec section 7: requested checks minus categories that errored on every single page.

Acceptance: existing tests updated, new test asserting `dependencies` is populated correctly when package.json files exist.

### Step 12: Prioritize and diff updates

In `src/audit/prioritize.ts`:

- Change the grouping key from `category:severity` to `rule_id`. Two findings of the same rule on different pages collapse into one Fix.
- Compute `pages_affected` as the unique set of `Finding.url` values across `finding_ids`.
- Pull `title` and `description` from the catalog (not from the finding's title, which is per-instance).
- Sort: worst severity first, then `finding_ids.length` descending, then `rule_id` ascending for stable ties.

In `src/audit/diff.ts`:

- Populate `before_meta` and `after_meta` from the input reports' `meta` blocks, picked down to the four fields per schemas spec section 1.10.
- Set `comparable: false` and add notes when:
  - `before.meta.perf_profile !== after.meta.perf_profile`: note `"perf profile differs: {before} vs {after}"`
  - Major versions of `axe_core`, `lighthouse`, or `playwright` differ between runs: note `"{name} major version differs: {before} vs {after}"`
- Otherwise `comparable: true`, `comparability_notes: []`.

Update tests for both modules. The existing diff fixture needs the new meta shape.

Acceptance: tests pass.

### Step 13: Markdown renderer pass

In `src/report/markdown.ts`:

- Update template interpolation to handle the new fields. Specifically, fix titles now come from the catalog (not from the per-instance finding title). Source field is null for every finding; render nothing for the source line when it is null.
- Handle errored categories in the per-page section: render a single line `Category {name}: errored ({error.message})` in place of the category breakdown.
- Handle skipped categories: omit them from the per-page section entirely. They are present in the JSON for consumers but are noise in the human-readable report.
- The summary paragraph stays deterministic. No prose generation. No AI tells.

Add or update tests:

- The renderer handles a report with one errored and one skipped category without crashing
- Snapshot test against `tests/fixtures/sample-report.json` reflects the new schema
- Snapshot test asserts no em dashes, no smart quotes in the output

Acceptance: snapshot tests pass against the regenerated fixture. Manual scan of the rendered output confirms it reads like a senior engineer wrote it.

### Step 14: End-to-end verification

This step is the headline acceptance gate. Run the full audit against `https://example.com` and confirm every promise in section 7.

Manual command sequence (run locally, not in CI):

```bash
foxhole run --url https://example.com --output json
foxhole run --url https://example.com --output markdown
foxhole run --url https://example.com --checks a11y --output json
foxhole run --url https://example.com --checks perf --output json
foxhole run --url https://example.com --checks semantic --output json
foxhole run --url https://example.com --checks bundle --output json
foxhole run --build ./tests/fixtures/static --urls /spa.html --output json
foxhole compare ./before.json ./after.json
```

Each command must:

- Complete in a reasonable time (perf budget per v1 spec section 13)
- Produce output that validates against the Zod schema (pipe through `node -e "require('./dist/types/schema').auditReportSchema.parse(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')))"`)
- Exit 0 (no threshold) or 1 (below threshold) or 2 (runtime error). Document each command's expected exit code in the spec PR description.

If any command crashes or produces a report that fails Zod validation, that is a blocker for the phase.

### Step 15: Documentation pass

- Update `CLAUDE.md` repository map to list `src/catalog/`. Add a Skills table entry: `Any catalog content authoring -> finding-normalization` (the catalog and the runner share the same authorship rules).
- Update `PHASES.md` Phase 1 entry: rewrite to reflect actual scope. Add a paragraph naming what is _not_ in scope (source maps, Lighthouse unification, CLI flag plumbing for the v1 spec section 5.2 flags) so the next phase author has explicit hand-off.
- Update `README.md` Known limitations to add the three deferred items.
- Write `docs/spec/findings-catalog.md`. Short. Defines: what a catalog entry looks like, how to add one, the recommendation tone, the catalog-gap fallback. Cross-reference to schemas spec section 8 (the canonical entry shape) and ADR-002 (the fallback policy).

Acceptance: a senior engineer reading `CLAUDE.md`, `PHASES.md`, and `findings-catalog.md` can author a new catalog entry and a new runner without asking questions.

---

## 4. Data flow

Two things change. First, runners now look up everything from the catalog and produce findings with stable hashes:

```
runner pass (axe / lighthouse / semantic / bundle)
  |
  vendor output (raw)
  |
  for each item:
    catalog lookup by rule_id
      |
    if hit: use catalog severity, effort, title, description, recommendation
    if miss: fall back per ADR-002, log catalog gap at debug
      |
    build semantic_path from outerHTML or resource URL
    build text_fingerprint from rule_id + detail
    compute finding_id = sha256(page_url \0 rule_id \0 semantic_path \0 text_fingerprint).slice(0, 16)
      |
    Finding { id, rule_id, source: null, ... }
```

Second, the orchestrator catches errors per category, not per page:

```
runner orchestrator (per page)
  |
  navigate page (page-level try/catch; failure -> page errored)
  |
  for each requested check:
    try {
      await runner(page, url)
      collect findings, build ok category
    } catch (RunnerError) {
      build errored category with error.message
      continue to next runner
    }
  |
  scorePage(pageResult, requestedChecks)
    enforces length-4 categories invariant
    skipped for non-requested
    errored preserved from runner layer
    ok with computed score for the rest
```

---

## 5. Error cases

| Failure                                             | Where caught                            | Behavior                                                                |
| --------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Page navigation throws (URL unreachable, DNS)       | per-page outer catch in runner/index.ts | PageResult.status = errored, all 4 categories errored, run continues    |
| axe runner throws                                   | per-category catch in runner/index.ts   | a11y category errored, other categories run, page status remains ok     |
| Lighthouse runner throws                            | per-category catch in runner/index.ts   | perf category errored, other categories run, page status remains ok     |
| Semantic runner throws                              | per-category catch in runner/index.ts   | semantic category errored, other categories run, page status remains ok |
| Bundle runner throws                                | per-category catch in runner/index.ts   | bundle category errored, other categories run, page status remains ok   |
| Catalog gap (vendor rule not in catalog)            | inside runner                           | Fallback per ADR-002, debug log, finding still produced                 |
| package.json read for dependency version fails      | audit/index.ts orchestrator entry       | Throw RunnerError. The install is broken; refuse to produce a report.   |
| Lighthouse separate-Chrome failure                  | inside runner                           | Caught by per-category catch above. perf errored, run continues.        |
| Static server fails to start (--build mode)         | CLI top-level                           | Exit code 2 (no audit ran)                                              |
| Zod schema validation fails on a constructed report | should not happen                       | Programming error; throw. This is the safety net for type drift.        |

The Zod safety net at orchestrator output is debatable. Per architecture spec section 5.3, we do not Zod-validate orchestrator output because the compiler enforces shape. I recommend skipping the runtime check; the type system is sufficient. If a runtime check is desired, gate it behind `FOXHOLE_DEBUG=1` to keep production overhead at zero.

---

## 6. Test plan

New test files (full list in section 2). Existing test files updated for schema sync.

Coverage targets:

- `src/runner/finding-id.ts`: 100%
- `src/catalog/`: structural coverage (every entry validated, every required field asserted)
- `src/runner/{axe,lighthouse,semantic,bundle}.ts`: above 85% line coverage, including catalog-hit and catalog-miss paths
- `src/audit/score.ts`: 100% coverage of the length-4 invariant logic
- `src/audit/prioritize.ts`: tests for grouping by rule_id, stable sort, pages_affected
- `src/audit/diff.ts`: tests for comparable=false paths

Integration tests deferred. The end-to-end verification in step 14 is manual; CI integration tests against fixture pages land in Phase 2 or later. The boundary: unit tests cover normalization and orchestration logic; manual verification covers real-world axe-core and Lighthouse output. Reason: capturing live Lighthouse output for fixtures is non-trivial and the resulting fixtures go stale every Lighthouse minor version.

All existing 25+ tests must continue to pass after schema sync.

---

## 7. Acceptance criteria

Run after implementation. All must pass.

```
npm run typecheck   # zero errors
npm run lint        # zero errors
npm run test        # all tests pass, including all new tests
node bin/foxhole.js --help   # clean output
```

End-to-end (manual, run locally on the implementation branch):

```bash
# Full audit, default checks, against a real URL
foxhole run --url https://example.com --output json > /tmp/example.json
node -e "
const { auditReportSchema } = require('./dist/types/schema.js');
const report = JSON.parse(require('fs').readFileSync('/tmp/example.json', 'utf8'));
auditReportSchema.parse(report);
console.log('schema: ok');
console.log('pages:', report.pages.length);
console.log('categories per page:', report.pages.map(p => p.categories.length));
console.log('all categories length 4:', report.pages.every(p => p.categories.length === 4));
console.log('all findings have rule_id:', report.pages.every(p => p.findings.every(f => typeof f.rule_id === 'string')));
console.log('all findings have source null:', report.pages.every(p => p.findings.every(f => f.source === null)));
"

# Markdown output
foxhole run --url https://example.com --output markdown

# Each check in isolation
foxhole run --url https://example.com --checks a11y --output json
foxhole run --url https://example.com --checks perf --output json
foxhole run --url https://example.com --checks semantic --output json
foxhole run --url https://example.com --checks bundle --output json

# --build mode
foxhole run --build ./tests/fixtures/static --urls /spa.html --output json

# Compare
foxhole compare ./tests/fixtures/sample-report.json ./tests/fixtures/sample-report.json
```

For each command:

- Exit code 0 (no threshold) or 1 (below threshold)
- JSON output validates against `auditReportSchema`
- Every page has exactly 4 categories
- Every finding has a populated `rule_id` and `source: null`
- `RunMeta.dependencies` is populated with real version strings
- No `crawl_depth` in the output

Per-category error isolation verification:

```bash
# Force a runner failure to verify the page survives
# (manually corrupt one runner during a test run, or use an unreachable URL pattern)
foxhole run --urls https://example.com,https://localhost:9999/unreachable --output json
```

Expected: two pages in output. example.com has page status ok, all four categories ok or with findings. The localhost URL has page status errored, all four categories errored. Run exits with code 1 or 2 depending on threshold (page-level errors do not crash the orchestrator).

---

## 8. Open questions

1. **Catalog gap policy: warn always, or only at debug?** Section 3 step 5 says debug-only. ADR-002 says debug-level. The architecture spec section 5.3 says "debug log warning". Confirmed: debug-only. No change needed; just naming the policy here so it is not relitigated.

2. **outerHTML truncation length for semantic path.** Step 7 specifies 500 chars. This is enough for typical elements with class names and a few children. If real-world HTML in the seed semantic checks shows the truncation hitting on common cases, raise to 1000. Decide during implementation; not a phase blocker.

3. **Should the runner orchestrator pass `requestedChecks` into `scorePage`, or should `scorePage` infer it from `categories[].status`?** Step 10 takes the explicit-pass approach. Inference would require `scorePage` to know that "absent category" means "skipped" and "present category" means "requested", which couples it to the orchestrator's contract. Explicit is cleaner. Confirmed; no decision pending.

4. **Lighthouse `accessibility_score` versus Foxhole-computed a11y category score.** Schemas spec section 1.6 says these are different and consumers comparing them should expect divergence. The summary in `audit/summarize.ts` uses the Foxhole score. Confirmed; no change.

No blocking questions. Proceed to `/flow:implement`.
