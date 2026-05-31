---
name: finding-normalization
description: Finding normalization rules for foxhole runners. Use whenever working in src/runner/ or src/catalog/, OR the user asks about Finding shape, severity mapping, finding IDs, selector handling, or WCAG extraction.
metadata:
  type: project
---

# Skill: Finding normalization

The `Finding` type is the canonical unit of audit output. All runners produce raw output from Lighthouse, axe-core, semantic checks, or bundle analysis. That raw output must be normalized into `Finding` objects before leaving the runner layer. Normalization must be consistent, deterministic, and happen in exactly one place per runner.

## The canonical Finding type

```typescript
interface SourceLocation {
  file: string;
  line: number;
  column: number;
  snippet: string | null;
}

interface Finding {
  id: string;
  category: CheckCategory;
  severity: Severity;
  effort: Effort;
  rule_id: string;
  title: string;
  description: string;
  recommendation: string;
  selector: string | null;
  wcag: string | null;
  impact: string | null;
  source: SourceLocation | null;
  kind: "framework" | "application" | null;
  url: string;
}
```

`source` is always `null` in all runners (source map integration is deferred). `kind` is only set by the bundle runner (`"framework"` or `"application"`); all other runners set it to `null`.

## Rule ID format

Rule IDs follow `{category}/{engine-rule-id}`:

- axe-core: `a11y/${violation.id}` e.g. `a11y/image-alt`
- Lighthouse: `perf/${audit.id}` e.g. `perf/render-blocking-resources`
- Semantic: `semantic/${ruleId}` e.g. `semantic/missing-main`
- Bundle: `bundle/${ruleId}` e.g. `bundle/large-js-chunk`

## ID generation

Finding IDs are 16 hex characters -- the first 16 chars of a sha256 hash of four inputs joined by null bytes:

```
sha256(`${pageUrl}\0${ruleId}\0${semanticPath}\0${textFingerprint}`).digest("hex").slice(0, 16)
```

IDs are page-scoped, not globally unique. Two findings on different pages can share an ID. Never use ID alone as a global key; use `(page_url, id)` pairs. ID changes when markup structure changes (semanticPath is derived from HTML), which can cause false regressions if the page's DOM is refactored.

## Severity mapping

### axe-core

Catalog entry wins when present. Fallback:

| axe-core impact | Foxhole severity |
| --------------- | ---------------- |
| `critical`      | `critical`       |
| `serious`       | `critical`       |
| `moderate`      | `major`          |
| `minor`         | `minor`          |
| undefined/other | `major`          |

### Lighthouse

Only audits with `scoreDisplayMode` of `"binary"` or `"numeric"` are converted to findings. Catalog entry wins when present. Fallback:

| Score condition      | Foxhole severity |
| -------------------- | ---------------- |
| `score === null`     | `critical`       |
| `score < 0.5`        | `critical`       |
| `0.5 <= score < 0.9` | `major`          |
| `score >= 0.9`       | omit (passing)   |

Lighthouse produces no `minor` findings via the fallback path; only catalog overrides can produce minor Lighthouse findings.

## Effort mapping

Effort is implementation complexity, not calendar time. When no catalog entry exists, use these defaults:

| Finding type                                    | Effort   |
| ----------------------------------------------- | -------- |
| Missing alt text, labels, landmarks             | `low`    |
| Color contrast, focus indicators, heading order | `low`    |
| Render-blocking resources, unused CSS           | `medium` |
| LCP optimization, font loading strategy         | `medium` |
| Core Web Vitals requiring architectural changes | `high`   |
| Bundle splitting, lazy loading strategy         | `high`   |
| Semantic restructuring of large page sections   | `high`   |

When uncertain, err toward higher effort.

## Selector handling

- Use `sanitizeSelector(selectorRaw)` from `src/runner/sanitize.ts` on any axe-core selector before storing.
- `sanitizeSelector` removes `<`, `>`, and backtick characters and truncates to 200 characters.
- For Lighthouse and semantic findings that do not map to a single element, set `selector` to `null`.
- Never fabricate selectors.

## WCAG extraction

- Populate `wcag` only for `a11y` category findings.
- If the catalog entry provides a `wcag` field, use it.
- Otherwise extract from axe-core's `tags` array: find the first tag matching `/^wcag\d+$/` (e.g. `wcag111`, `wcag2aa`), then split the digit string into `major.minor.clause`.
- Set `wcag` to `null` for all non-a11y findings.

## Text content rules

- `title`: short sentence, sentence case, no trailing period, under 60 characters
- `description`: what the problem is, one to two sentences, plain language
- `recommendation`: what to do, actionable, starts with a verb, one to three sentences
- No em dashes, no smart quotes, plain ASCII only
- No WCAG clause references in user-facing text

## Anti-patterns

**failure**: Setting `id` to a random value, a timestamp, or a `{category}-{rule-id}` string. IDs must be the sha256-based hash so they remain stable across runs for regression detection.

**failure**: Including passing audits as findings. Lighthouse audits with `score >= 0.9` are omitted. axe-core passes are not reported by the engine.

**failure**: Skipping `sanitizeSelector` before storing an axe-core selector. Raw selectors can contain backticks and angle brackets that break markdown rendering.

**warning**: Setting `kind` on non-bundle findings. Only the bundle runner sets `kind`; all others must set it to `null`.

**warning**: Putting scoring or prioritization logic inside a runner. Normalization produces `Finding[]`. Scoring happens in `src/audit/score.ts`. Prioritization in `src/audit/prioritize.ts`.

**info**: Using catalog fallbacks for well-known rules. If a rule has stable, known effort and severity, add it to the catalog rather than relying on the engine-impact fallback.

## When to load this skill

- Editing any file in `src/runner/`
- Editing any file in `src/catalog/`
- Adding a new runner or new rule to the catalog
- Reviewing Finding construction code
- Debugging why finding IDs changed between runs

## When not to load this skill

- Working in `src/audit/`, `src/report/`, or `src/cli/` (those layers consume findings, they do not produce them)
- Adding tests that construct fixture findings (use the schema for reference instead)

## References

- `src/types/schema.ts` -- canonical Zod schema for `Finding` and `SourceLocation`
- `src/runner/finding-id.ts` -- `computeFindingId`, `buildSemanticPath`, `buildTextFingerprint`
- `src/runner/sanitize.ts` -- `sanitizeSelector`
- `src/runner/axe.ts` -- reference implementation of axe normalization
- `src/runner/lighthouse.ts` -- reference implementation of Lighthouse normalization
- `docs/spec/schemas.md` section 1.1 -- `Finding` field descriptions
- `docs/spec/findings-catalog.md` -- catalog entry format and authoring rules
