---
"@ku5ic/foxhole": patch
---

Config-aware run and MCP audit tools now auto-discover `foxhole.config.json` from the current directory without a `--config` flag; CLI flags override config values. `foxhole compare --threshold <n>` exits with code 1 when `score_delta` falls below the threshold, enabling CI regression gating. Documentation corrected to match the actual CLI surface.
