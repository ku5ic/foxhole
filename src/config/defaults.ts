import type { CheckCategory } from "../types/index.js";
import type { ThrottlingPreset } from "../runner/index.js";

const DEFAULT_CHECKS: CheckCategory[] = ["perf", "a11y", "semantic", "bundle"];
const DEFAULT_OUTPUT = "markdown";
const DEFAULT_THROTTLING: ThrottlingPreset = "none";

export { DEFAULT_CHECKS, DEFAULT_OUTPUT, DEFAULT_THROTTLING };
