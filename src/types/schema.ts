import { z } from "zod";

const severitySchema = z.enum(["critical", "major", "minor"]);
const effortSchema = z.enum(["low", "medium", "high"]);
const checkCategorySchema = z.enum(["perf", "a11y", "semantic", "bundle"]);
const categoryStatusSchema = z.enum(["ok", "errored", "skipped"]);
const inputModeSchema = z.enum(["url", "urls", "build"]);

const sourceLocationSchema = z.object({
  file: z.string(),
  line: z.number().int(),
  column: z.number().int(),
  snippet: z.string().nullable(),
});

const findingSchema = z.object({
  id: z.string(),
  category: checkCategorySchema,
  severity: severitySchema,
  effort: effortSchema,
  rule_id: z.string(),
  title: z.string(),
  description: z.string(),
  recommendation: z.string(),
  selector: z.string().nullable(),
  wcag: z.string().nullable(),
  impact: z.string().nullable(),
  source: sourceLocationSchema.nullable(),
  url: z.string(),
});

const fixSchema = z.object({
  rank: z.number().int(),
  finding_ids: z.array(z.string()),
  rule_id: z.string(),
  title: z.string(),
  description: z.string(),
  effort: effortSchema,
  severity: severitySchema,
  category: checkCategorySchema,
  pages_affected: z.array(z.string()),
});

const categorySummarySchema = z.object({
  category: checkCategorySchema,
  status: categoryStatusSchema,
  error: z.object({ message: z.string() }).nullable(),
  score: z.number().int(),
  findings_count: z.number().int(),
  critical_count: z.number().int(),
  major_count: z.number().int(),
  minor_count: z.number().int(),
});

const performanceMetricsSchema = z.object({
  lcp: z.number().nullable(),
  fid: z.number().nullable(),
  cls: z.number().nullable(),
  fcp: z.number().nullable(),
  ttfb: z.number().nullable(),
  tbt: z.number().nullable(),
  performance_score: z.number().nullable(),
  accessibility_score: z.number().nullable(),
  bundle_size: z.number().nullable(),
});

const pageResultSchema = z
  .object({
    url: z.string(),
    status: z.enum(["ok", "errored"]),
    error: z.object({ message: z.string() }).nullable(),
    score: z.number().int(),
    categories: z.array(categorySummarySchema),
    findings: z.array(findingSchema),
    metrics: performanceMetricsSchema,
    audited_at: z.string(),
    duration_ms: z.number().int(),
  })
  .strict();

const dependenciesSchema = z.object({
  axe_core: z.string(),
  lighthouse: z.string(),
  playwright: z.string(),
});

const runMetaSchema = z
  .object({
    foxhole_version: z.string(),
    node_version: z.string(),
    platform: z.string(),
    audited_at: z.string(),
    input_mode: inputModeSchema,
    checks_run: z.array(checkCategorySchema),
    page_count: z.number().int(),
    duration_ms: z.number().int(),
    threshold: z.number().nullable(),
    passed: z.boolean(),
    concurrency: z.number().int(),
    perf_runs: z.number().int(),
    perf_profile: z.enum(["fast", "standard", "mobile"]),
    source_maps: z.enum(["auto", "on", "off"]),
    dependencies: dependenciesSchema,
  })
  .strict();

const auditReportSchema = z
  .object({
    version: z.literal(1),
    summary: z.string(),
    score: z.number().int(),
    pages: z.array(pageResultSchema),
    prioritized_fixes: z.array(fixSchema),
    meta: runMetaSchema,
  })
  .strict();

// Snapshot of four RunMeta fields used to describe each side of a diff
const runMetaSnapshotSchema = runMetaSchema.pick({
  foxhole_version: true,
  audited_at: true,
  perf_profile: true,
  dependencies: true,
});

const runDiffSchema = z
  .object({
    before_meta: runMetaSnapshotSchema,
    after_meta: runMetaSnapshotSchema,
    comparable: z.boolean(),
    comparability_notes: z.array(z.string()),
    score_delta: z.number(),
    passed: z.boolean(),
    regressions: z.array(findingSchema),
    improvements: z.array(findingSchema),
    unchanged: z.array(findingSchema),
    metrics_delta: performanceMetricsSchema.partial(),
    summary: z.string(),
  })
  .strict();

export {
  severitySchema,
  effortSchema,
  checkCategorySchema,
  categoryStatusSchema,
  inputModeSchema,
  sourceLocationSchema,
  findingSchema,
  fixSchema,
  categorySummarySchema,
  performanceMetricsSchema,
  pageResultSchema,
  dependenciesSchema,
  runMetaSchema,
  runMetaSnapshotSchema,
  auditReportSchema,
  runDiffSchema,
};
