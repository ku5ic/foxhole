import type { CheckCategory, Effort, Severity } from "../types/index.js";

import { axeCatalog } from "./axe.js";
import { bundleCatalog } from "./bundle.js";
import { lighthouseCatalog } from "./lighthouse.js";
import { semanticCatalog } from "./semantic.js";

interface CatalogEntry {
  rule_id: string;
  source: "axe" | "lighthouse" | "semantic" | "bundle";
  vendor_rule_id: string | null;
  category: CheckCategory;
  default_severity: Severity;
  default_effort: Effort;
  wcag: string | null;
  title_template: string;
  description_template: string;
  recommendation: string;
}

const catalog: Record<string, CatalogEntry> = {
  ...axeCatalog,
  ...lighthouseCatalog,
  ...semanticCatalog,
  ...bundleCatalog,
};

export { catalog };
export type { CatalogEntry };
