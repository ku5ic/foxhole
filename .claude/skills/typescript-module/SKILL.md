# Skill: TypeScript module scaffold

Every module in the Foxhole codebase follows this exact structure. Do not deviate.

## Module structure order

1. Node built-in imports
2. Third-party imports
3. Internal imports (use relative paths)
4. Types and interfaces local to this module
5. Constants
6. Implementation
7. Exports

## Rules

- No default exports. Named exports only.
- Explicit return types on every function, no exceptions.
- Explicit parameter types on every function, no exceptions.
- No `any`. Use `unknown` and narrow it.
- No non-null assertions (`!`). Handle nullability explicitly.
- Interfaces over type aliases for object shapes.
- Type aliases for unions, primitives, and computed types.
- No barrel re-exports that obscure where something lives.
- One concept per file. If a file needs a second concept, it needs a second file.

## Naming conventions

- Files: kebab-case
- Interfaces: PascalCase, no `I` prefix
- Types: PascalCase
- Functions: camelCase, verb-first (e.g. `runAudit`, `mapFinding`, `loadConfig`)
- Constants: SCREAMING_SNAKE_CASE for module-level constants
- Private helpers: camelCase, no underscore prefix

## Example structure

```typescript
import path from "node:path";

import { chromium } from "playwright";

import { mapFinding } from "../audit/score.ts";
import type { Finding, CheckCategory } from "../types/index.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

interface RunnerOptions {
  url: string;
  categories: CheckCategory[];
  timeoutMs?: number;
}

async function runAxe(options: RunnerOptions): Promise<Finding[]> {
  // implementation
}

export { runAxe };
export type { RunnerOptions };
```

## What never belongs in a module

- Business logic in CLI command files. Commands parse input and delegate.
- Rendering logic in runner files. Runners produce data.
- Scoring logic in renderer files. Renderers consume data.
- Direct axe-core or Lighthouse imports outside of src/runner/.
- Direct Playwright imports outside of src/runner/browser.ts.
