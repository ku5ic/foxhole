export type CheckCategory = "perf" | "a11y" | "semantic" | "bundle";
export type Severity = "critical" | "major" | "minor";
export type Effort = "low" | "medium" | "high";

export interface Finding {
  id: string;
  category: CheckCategory;
  severity: Severity;
  effort: Effort;
  title: string;
  description: string;
  recommendation: string;
  selector: string | null;
  wcag: string | null;
  impact: string | null;
  url: string;
}

export interface Fix {
  rank: number;
  finding_ids: string[];
  title: string;
  description: string;
  effort: Effort;
  severity: Severity;
  category: CheckCategory;
}

export interface CategorySummary {
  category: CheckCategory;
  score: number;
  findings_count: number;
  critical_count: number;
  major_count: number;
  minor_count: number;
}

export interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  tbt: number | null;
  performance_score: number | null;
  accessibility_score: number | null;
  bundle_size: number | null;
}

export interface PageResult {
  url: string;
  score: number;
  categories: CategorySummary[];
  findings: Finding[];
  metrics: PerformanceMetrics;
  audited_at: string;
}

export interface RunMeta {
  foxhole_version: string;
  node_version: string;
  platform: string;
  input_mode: "url" | "urls" | "build";
  checks_run: CheckCategory[];
  crawl_depth: number;
  duration_ms: number;
  threshold: number | null;
  passed: boolean;
}

export interface AuditReport {
  version: 1;
  summary: string;
  score: number;
  pages: PageResult[];
  prioritized_fixes: Fix[];
  meta: RunMeta;
}

export interface RunDiff {
  score_delta: number;
  passed: boolean;
  regressions: Finding[];
  improvements: Finding[];
  unchanged: Finding[];
  metrics_delta: Partial<PerformanceMetrics>;
  summary: string;
}
