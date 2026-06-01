import { computeFindingId } from "./finding-id.js";
import type { CheckCategory, Effort, Finding, Severity } from "../types/index.js";

interface MakeFindingArgs {
  category: CheckCategory;
  ruleId: string;
  pageUrl: string;
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
  effort: Effort;
  textFingerprint: string;
  semanticPath?: string;
  selector?: string | null;
  wcag?: string | null;
  impact?: string | null;
  kind?: "framework" | "application" | null;
}

function makeFinding(args: MakeFindingArgs): Finding {
  return {
    id: computeFindingId({
      pageUrl: args.pageUrl,
      ruleId: args.ruleId,
      semanticPath: args.semanticPath ?? "",
      textFingerprint: args.textFingerprint,
    }),
    category: args.category,
    severity: args.severity,
    effort: args.effort,
    rule_id: args.ruleId,
    title: args.title,
    description: args.description,
    recommendation: args.recommendation,
    selector: args.selector ?? null,
    wcag: args.wcag ?? null,
    impact: args.impact ?? null,
    source: null,
    kind: args.kind ?? null,
    url: args.pageUrl,
  };
}

export { makeFinding };
export type { MakeFindingArgs };
