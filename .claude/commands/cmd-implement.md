Execute the implementation plan produced by cmd-plan. Do not deviate from the plan without flagging the deviation explicitly.

## Before writing any code

- Confirm the plan is complete and has no unresolved open questions
- Confirm all relevant skills are loaded
- Confirm all files being modified are loaded in context

## Implementation rules

Follow these rules for every file written or modified.

### Structure

- Follow the TypeScript module scaffold skill for every module
- One concept per file
- Named exports only, no default exports
- Explicit return types on every function

### Types

- No `any`
- No non-null assertions
- Explicit parameter types on every function
- Use types from src/types/index.ts, do not redefine them locally

### Error handling

- Follow the error handling skill
- Every async function that can fail returns a Result type or throws a typed error class
- No silent catch blocks

### Security

- Validate all user-supplied input at the boundary
- Follow the security skill for URLs, file paths, and selectors

### Finding normalization

- Follow the finding-normalization skill exactly for any code in src/runner/
- Severity and effort mappings are in the skill, do not invent new ones

### CLI commands

- Follow the CLI command scaffold skill for any code in src/cli/commands/
- Commands are thin, no business logic

### MCP tools

- Follow the MCP tool scaffold skill for any code in src/mcp/tools/
- Tools delegate to src/audit/, never to src/runner/ directly

## Deviation protocol

If during implementation you discover the plan is wrong or incomplete:

1. Stop
2. State what you discovered and why the plan needs to change
3. Propose the change
4. Wait for confirmation before continuing

Do not silently implement something different from the plan.

## Output

After implementation is complete, produce a summary:

- Files created (with line counts)
- Files modified (with a one-line description of each change)
- Any deviations from the plan and why
- Any technical debt or follow-up work introduced
