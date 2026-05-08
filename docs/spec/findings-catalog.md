# Findings catalog authoring guide

The findings catalog (`src/catalog/`) is a static registry that maps rule IDs to human-facing metadata: titles, severities, effort estimates, WCAG references, and recommendations. Runners look up catalog entries to produce consistent `Finding` objects without duplicating metadata across the codebase.

Read this document before adding a new catalog entry, a new runner check, or modifying an existing rule.

---

## What the catalog is and is not

The catalog is a **static registry**, not a rules engine. It does not execute checks. Runners (axe, Lighthouse, semantic, bundle) execute the check logic and then look up the catalog to annotate their raw results.

The catalog is not the source of truth for which checks run. That is controlled by `--checks` flags and runner logic. The catalog only governs presentation: what the finding says, how severe it is, and how hard it is to fix.

---

## File layout

```
src/catalog/
  index.ts       Merges sub-catalogs, exports CatalogEntry interface and catalog map
  axe.ts         Entries for axe-core rule IDs
  lighthouse.ts  Entries for Lighthouse audit IDs
  semantic.ts    Entries for semantic HTML checks
  bundle.ts      Entries for bundle analysis rules
```

Each sub-catalog exports a `Record<string, CatalogEntry>` with the sub-catalog's scope of rule IDs. `index.ts` spreads them into a single merged map.

---

## The CatalogEntry interface

```typescript
interface CatalogEntry {
  rule_id: string;
  title_template: string;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  recommendation: string;
}
```

### Fields

**`rule_id`**

The stable identifier for this rule. Format: `{category}/{slug}`. Examples:

- `a11y/image-alt`
- `perf/render-blocking-resources`
- `semantic/missing-h1`
- `bundle/total-js-size`

Must match the `rule_id` field used by the runner that produces this finding. The catalog map is keyed by `rule_id`.

**`title_template`**

Short label, sentence case, no trailing period, under 60 characters. This becomes `Finding.title` and `Fix.title`.

Good: `"Image missing alt text"`
Bad: `"Images must have alternative text (WCAG 1.1.1)."` (jargon, period, too long)

**`default_severity`**

One of: `"critical"`, `"major"`, `"minor"`.

Use the severity table from the finding-normalization skill. When in doubt: a user-facing defect that blocks assistive technology is critical; a structural problem that degrades experience is major; a polish or warning-level issue is minor.

**`default_effort`**

One of: `"low"`, `"medium"`, `"high"`.

Effort is implementation complexity, not time. Use the effort table from the finding-normalization skill. When in doubt, err toward higher effort. Underestimating breaks trust.

| Finding type                                        | Effort |
| --------------------------------------------------- | ------ |
| Missing alt text, missing labels, missing landmarks | low    |
| Color contrast, focus indicators, heading order     | low    |
| Render-blocking resources, unused CSS               | medium |
| LCP image optimization, font loading strategy       | medium |
| Core Web Vitals requiring architectural changes     | high   |
| Bundle splitting, lazy loading strategy             | high   |
| Semantic restructuring of large page sections       | high   |

**`wcag`**

Short clause format: `"1.1.1"`, `"2.4.7"`. Set to `null` for non-a11y rules.

Map from axe-core rule IDs to WCAG clauses using the axe-core tags array. The tag format is `wcag{level}{clause}`, e.g. `wcag2aa`, `wcag111`. Only populate WCAG for `a11y` category entries.

**`recommendation`**

What to do about the finding. One to three sentences. Starts with a verb. Plain language, no jargon.

Good: `"Add descriptive alt text to each image. Use empty alt=\"\" for purely decorative images."`
Bad: `"The image element must include a non-empty alt attribute per WCAG Success Criterion 1.1.1."`

---

## Fallback behavior (ADR-002)

Runners look up the catalog for each finding before constructing the `Finding` object:

```typescript
const entry = catalog[ruleId];
findings.push({
  severity: entry?.default_severity ?? fallbackSeverity,
  title: entry?.title_template ?? fallbackTitle,
  // ...
});
```

If the entry is missing, the runner falls back to vendor data (axe-core impact, Lighthouse score range, etc.) and emits a debug line to stderr when `FOXHOLE_DEBUG=1`:

```
[foxhole:debug] catalog gap: a11y/unknown-rule
```

A catalog gap is a bug. Every rule a runner can produce must have a catalog entry. The debug flag makes gaps visible during development without polluting normal output.

---

## Adding a new catalog entry

1. Identify which sub-catalog owns the rule: `axe.ts`, `lighthouse.ts`, `semantic.ts`, or `bundle.ts`.
2. Verify the `rule_id` matches exactly what the runner uses. Check the runner source before writing the entry.
3. Write the entry following the field rules above.
4. Add a test in the corresponding runner test file that asserts the `title` field matches the `title_template`. The runner tests already do this for existing rules - see `tests/runner/bundle.test.ts` for examples.
5. Run `npm run typecheck` and `npm run lint`. The spread in `catalog/index.ts` verifies structural compatibility at compile time.

No separate test file for the catalog itself is required. Correctness is verified by runner tests that assert on specific field values produced from catalog lookups.

---

## Naming conventions for rule_id

- Prefix matches the check category: `a11y/`, `perf/`, `semantic/`, `bundle/`
- Slug is lowercase kebab-case, under 40 characters
- For axe-core rules: use the axe rule ID as the slug (e.g. `a11y/image-alt` from axe rule `image-alt`)
- For Lighthouse audits: use the Lighthouse audit ID as the slug (e.g. `perf/render-blocking-resources`)
- For custom checks: choose a slug that describes the violation, not the check mechanism

---

## Text content rules

These apply to all user-facing strings in the catalog and must be enforced in code review.

- Plain ASCII punctuation only. No em dashes, no smart quotes.
- No WCAG jargon in `title_template` or `recommendation`. "Images must have alternative text" not "SC 1.1.1 non-text content failure".
- `title_template` is a label, not a sentence. No trailing period.
- `recommendation` starts with a verb. "Add", "Remove", "Split", "Replace", "Update".
- No passive voice in `recommendation`. "Add alt text to each image" not "Alt text should be added".

---

## Catalog sub-module structure

Each sub-module imports only primitive types from `../types/index.js`. It does not import from `catalog/index.ts` to avoid circular dependencies. The structural check happens at the spread site in `index.ts`.

```typescript
// axe.ts pattern
import type { Effort, Severity } from "../types/index.js";

interface AxeCatalogEntry {
  rule_id: string;
  title_template: string;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  recommendation: string;
}

const axeCatalog: Record<string, AxeCatalogEntry> = {
  "a11y/image-alt": {
    rule_id: "a11y/image-alt",
    title_template: "Image missing alt text",
    default_severity: "critical",
    default_effort: "low",
    wcag: "1.1.1",
    recommendation:
      'Add descriptive alt text to each image. Use empty alt="" for decorative images.',
  },
  // ...
};

export { axeCatalog };
```

This pattern avoids importing `CatalogEntry` from `index.ts`, which would create a circular reference. TypeScript validates compatibility at the spread site.
