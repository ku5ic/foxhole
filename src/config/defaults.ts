import type { CheckCategory } from "../types/index.js";

const DEFAULT_CHECKS: CheckCategory[] = ["perf", "a11y", "semantic", "bundle"];
const DEFAULT_OUTPUT = "markdown";

export { DEFAULT_CHECKS, DEFAULT_OUTPUT };
