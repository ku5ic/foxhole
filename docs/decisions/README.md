# Architecture decisions

This folder contains the architecture decision records (ADRs) for Foxhole. ADRs capture decisions that shaped the codebase, with enough context that a reader six months later can understand why the code looks the way it does.

## Status pointer convention

Every ADR carries one of two statuses:

- `Status: Accepted` with a pointer to the spec section that elaborates the decision, where applicable.
- `Status: Superseded by <path>#<section>` when a later document overrides the decision.

A superseded ADR is kept for historical context. The body is preserved so a reader can see what the original decision was; the status line tells them where to read the current one.

## Index

| ADR                   | Title                                                                                           | Status                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-001](ADR-001.md) | Use axe-core and Lighthouse as complementary audit engines                                      | Accepted; accessibility category boundary narrowed by ADR-009                                                                                |
| [ADR-002](ADR-002.md) | Finding normalization schema and stable ID format                                               | Superseded by docs/spec/schemas.md sections 1.3, 2 and docs/spec/architecture.md section 5.3; scoreDisplayMode precondition added by ADR-009 |
| [ADR-003](ADR-003.md) | Error handling strategy                                                                         | Accepted                                                                                                                                     |
| [ADR-004](ADR-004.md) | Playwright wait strategy before running checks                                                  | Accepted                                                                                                                                     |
| [ADR-005](ADR-005.md) | Lighthouse uses a separate Chrome instance from Playwright                                      | Superseded by docs/spec/architecture.md section 13.4                                                                                         |
| [ADR-006](ADR-006.md) | MCP server uses stdio transport                                                                 | Accepted                                                                                                                                     |
| [ADR-007](ADR-007.md) | Monetization boundary is the --push flag                                                        | Accepted                                                                                                                                     |
| [ADR-008](ADR-008.md) | No automatic crawling in v1, explicit URL list for SPA support                                  | Accepted                                                                                                                                     |
| [ADR-009](ADR-009.md) | Lighthouse finding mapping, scoreDisplayMode filtering, and the accessibility category boundary | Accepted                                                                                                                                     |
