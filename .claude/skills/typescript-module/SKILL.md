---
name: typescript-module
description: TypeScript module structure conventions for the foxhole codebase. Use whenever creating or modifying any .ts file in src/, OR the user asks about module layout, import order, naming conventions, or what belongs in which layer of this project.
metadata:
  type: project
---

# Skill: TypeScript module scaffold

Every module in the foxhole codebase follows this exact structure. Do not deviate.

## Module structure order

1. Node built-in imports
2. Third-party imports
3. Internal imports (relative paths, `.js` extension)
4. Types and interfaces local to this module
5. Constants
6. Implementation
7. Exports

Internal imports use `.js` extensions even though the source files are `.ts`. This is the TypeScript `NodeNext` module resolution convention -- the compiled output uses `.js`, so imports reference the compiled target.

## Rules

- No default exports. Named exports only.
- Explicit return types on every function, no exceptions.
- Explicit parameter types on every function, no exceptions.
- No `any`. Use `unknown` and narrow it.
- No non-null assertions (`!`). Handle nullability explicitly.
- Interfaces for object shapes.
- Type aliases for unions, primitives, and computed types.
- No barrel re-exports that obscure where something lives.
- One concept per file. If a file needs a second concept, it needs a second file.

## Naming conventions

- Files: kebab-case
- Interfaces: PascalCase, no `I` prefix
- Types: PascalCase
- Functions: camelCase, verb-first (`runAudit`, `mapFinding`, `loadConfig`)
- Constants: SCREAMING_SNAKE_CASE for module-level constants
- Private helpers: camelCase, no underscore prefix

## Example structure

```typescript
import path from "node:path";

import { chromium } from "playwright";

import { catalogLookup } from "./catalog-lookup.js";
import type { Finding, CheckCategory } from "../types/index.js";

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

## Layer rules

These govern what belongs where. Violating them breaks the architecture invariants in CLAUDE.md.

- Business logic belongs in `src/audit/`. CLI commands and MCP tools delegate to it.
- Runner files in `src/runner/` produce `Finding[]`. They do not score, prioritize, or render.
- Renderers in `src/report/` consume `AuditReport`. They do not re-derive data.
- Shared types live in `src/types/index.ts` (generated from Zod via `z.infer`). Do not define types locally that belong there.
- axe-core and Lighthouse are imported only in `src/runner/`.
- Playwright is launched only in `src/runner/browser.ts`. Other runner files may `import type { Page }` but must not call `chromium.launch()` or `browser.newPage()`.

## Anti-patterns

**failure**: Default exports. Every export must be named. Default exports make refactoring and grep harder.

**failure**: `any` type. Use `unknown` and narrow with `instanceof` or type guards.

**failure**: Non-null assertions (`!`). Handle the null case explicitly or narrow with a guard.

**failure**: Importing from `../types/index.js` and then re-defining a type that already exists there. Check the schema file before adding types.

**warning**: Using `.ts` extensions in import paths. The project uses NodeNext resolution; imports must use `.js` extensions.

**warning**: Mixing two concepts in one file. If the file name requires "and", it probably needs to be split.

**info**: Skipping the explicit return type on a simple function. Even trivial functions need explicit return types -- the rule is absolute, not effort-dependent.

## When to load this skill

- Creating any new `.ts` file in `src/`
- Moving or restructuring modules
- Reviewing import paths, naming, or export style

## When not to load this skill

- Test files in `tests/` (test file conventions are in the foxhole-test-patterns skill)
- Config files (`tsconfig.json`, `vitest.config.ts`) -- those follow their own conventions

## References

- `src/types/schema.ts` -- Zod schemas; `src/types/index.ts` -- derived TypeScript types
- `tsconfig.json` -- confirms `moduleResolution: "NodeNext"` and `.js` import convention
- `CLAUDE.md` Architecture rules section -- layer ownership rules
