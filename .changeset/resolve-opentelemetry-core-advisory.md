---
"@ku5ic/foxhole": patch
---

Security: resolve GHSA-8988-4f7v-96qf (OpenTelemetry Core unbounded memory allocation in W3C Baggage propagation, moderate) via a package.json override pinning `@opentelemetry/core` to `^2.9.0`. The vulnerable copy was a transitive dependency of `lighthouse` -> `@sentry/node`'s bundled instrumentation, never imported by this project's own code.
