import type { z } from "zod";

import type {
  auditReportSchema,
  categorySummarySchema,
  categoryStatusSchema,
  checkCategorySchema,
  effortSchema,
  findingSchema,
  fixSchema,
  inputModeSchema,
  pageResultSchema,
  performanceMetricsSchema,
  runDiffSchema,
  runMetaSchema,
  severitySchema,
  sourceLocationSchema,
  throttlingPresetSchema,
} from "./schema.js";

export type CheckCategory = z.infer<typeof checkCategorySchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Effort = z.infer<typeof effortSchema>;
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;
export type InputMode = z.infer<typeof inputModeSchema>;
export type SourceLocation = z.infer<typeof sourceLocationSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Fix = z.infer<typeof fixSchema>;
export type CategorySummary = z.infer<typeof categorySummarySchema>;
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;
export type PageResult = z.infer<typeof pageResultSchema>;
export type RunMeta = z.infer<typeof runMetaSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;
export type RunDiff = z.infer<typeof runDiffSchema>;
export type ThrottlingPreset = z.infer<typeof throttlingPresetSchema>;

export type PageStatus = PageResult["status"];
