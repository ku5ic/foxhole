import { catalog } from "../catalog/index.js";
import type { CatalogEntry } from "../catalog/index.js";

function catalogLookup(ruleId: string): CatalogEntry | undefined {
  const entry = catalog[ruleId];
  if (!entry && process.env.FOXHOLE_DEBUG === "1") {
    process.stderr.write(`[foxhole:debug] catalog gap: ruleId=${ruleId}\n`);
  }
  return entry;
}

export { catalogLookup };
