import { z } from "zod";

const foxholeConfigSchema = z.object({
  url: z.url().optional(),
  urls: z.array(z.string()).optional(),
  checks: z
    .array(z.enum(["perf", "a11y", "semantic", "bundle"]))
    .optional()
    .default(["perf", "a11y", "semantic", "bundle"]),
  output: z.enum(["json", "markdown"]).optional().default("markdown"),
  throttling: z.enum(["desktop", "mobile", "none"]).optional(),
  out: z.string().optional(),
  threshold: z.number().min(0).max(100).optional(),
});

type FoxholeConfig = z.infer<typeof foxholeConfigSchema>;

export { foxholeConfigSchema };
export type { FoxholeConfig };
