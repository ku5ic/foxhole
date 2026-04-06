Before starting any implementation task, verify the following. Do not proceed until every item is confirmed.

## Context check

- [ ] The types in src/types/index.ts are loaded and understood
- [ ] The specific files being modified or created are identified
- [ ] Any files this task depends on are loaded and read
- [ ] The relevant skill files for this task are identified and read

## Skill selection

Identify which skills apply to this task and confirm they are loaded:

- TypeScript module scaffold: applies to any new or modified module
- Finding normalization: applies to any runner file
- Error handling: applies to any function that can fail
- CLI command scaffold: applies to any file in src/cli/commands/
- MCP tool scaffold: applies to any file in src/mcp/tools/
- Test patterns: applies to any test file
- Security: applies to any code touching user input, URLs, or file paths
- Markdown report: applies to src/report/markdown.ts

## Scope confirmation

State clearly:

1. What files will be created
2. What files will be modified
3. What files will not be touched
4. What the expected output or behavior change is

## Risk flags

Identify any of the following before starting:

- Changes to the Finding type or AuditReport schema (breaking change risk)
- Changes to scoring or prioritization logic (output quality risk)
- New dependencies being introduced (security and bundle risk)
- File system or network operations (security risk)
- Changes that affect MCP tool input or output shapes (API contract risk)

If any risk flags are present, state them explicitly before proceeding.
