# Skill: Finding normalization

The `Finding` type is the canonical unit of audit output. All runners produce raw output from Lighthouse or axe-core. That raw output must be normalized into `Finding` objects before leaving the runner layer. This normalization must be consistent, deterministic, and happen in exactly one place per runner.

## The canonical Finding type

```typescript
interface Finding {
  id: string;
  category: CheckCategory;
  severity: Severity;
  effort: Effort;
  title: string;
  description: string;
  recommendation: string;
  selector: string | null;
  wcag: string | null;
  impact: string | null;
  url: string;
}
```

## ID generation

IDs must be stable across runs for the same issue on the same page. Use the format:

```
{category}-{rule-id}
```

Examples:

- `a11y-image-alt`
- `perf-render-blocking-resources`
- `semantic-missing-main-landmark`
- `bundle-large-javascript-chunk`

Never use random or timestamp-based IDs. The diff logic depends on stable IDs.

## Severity mapping

### From axe-core

| axe-core impact | Foxhole severity |
| --------------- | ---------------- |
| critical        | critical         |
| serious         | critical         |
| moderate        | major            |
| minor           | minor            |

### From Lighthouse

| Lighthouse category       | Score range    | Foxhole severity                                |
| ------------------------- | -------------- | ----------------------------------------------- |
| opportunity or diagnostic | score < 0.5    | critical                                        |
| opportunity or diagnostic | score 0.5-0.89 | major                                           |
| opportunity or diagnostic | score >= 0.9   | minor                                           |
| passed audit              | any            | omit, do not include passing audits as findings |

## Effort mapping

Effort is an estimate of implementation complexity, not time. Map as follows:

| Finding type                                        | Effort |
| --------------------------------------------------- | ------ |
| Missing alt text, missing labels, missing landmarks | low    |
| Color contrast, focus indicators, heading order     | low    |
| Render-blocking resources, unused CSS               | medium |
| LCP image optimization, font loading strategy       | medium |
| Core Web Vitals requiring architectural changes     | high   |
| Bundle splitting, lazy loading strategy             | high   |
| Semantic restructuring of large page sections       | high   |

When in doubt, err toward higher effort. Underestimating effort breaks trust with users.

## Selector handling

- Use the selector provided by axe-core as-is when available.
- For Lighthouse findings that do not map to a single element, set `selector` to `null`.
- Never fabricate selectors. `null` is always preferable to a guess.
- Truncate selectors longer than 200 characters at a natural boundary.

## WCAG references

- Only populate `wcag` for `a11y` category findings.
- Use the short clause format: `"1.1.1"`, `"2.4.7"`, not the full title.
- Set `wcag` to `null` for all non-a11y findings.
- Map from axe-core rule IDs to WCAG clauses using the axe-core tags array. The relevant tag format is `wcag{level}{clause}`, e.g. `wcag2aa`, `wcag111`.

## Impact field

- Populate `impact` only for axe-core findings. It is the raw axe-core impact string.
- Set `impact` to `null` for all non-axe findings.

## Text content rules

- `title`: short label, sentence case, no trailing period, under 60 characters
- `description`: what the problem is, one to two sentences, plain language
- `recommendation`: what to do about it, actionable, starts with a verb, one to three sentences
- No em dashes, no smart quotes, plain ASCII punctuation only
- No WCAG jargon in user-facing text. "Images must have alternative text" not "SC 1.1.1 non-text content failure"

## What never belongs in normalization

- Scoring logic. Normalization produces findings. Scoring happens in src/audit/score.ts.
- Prioritization logic. That happens in src/audit/prioritize.ts.
- Rendering logic. Findings are data, not formatted output.
