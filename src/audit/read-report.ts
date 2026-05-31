import fs from "node:fs/promises";

import { ConfigError } from "../errors.js";
import { auditReportSchema } from "../types/schema.js";
import type { AuditReport } from "../types/index.js";

async function readAuditReport(filePath: string): Promise<AuditReport> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (cause) {
    throw new ConfigError(`Audit file not found: ${filePath}`, cause);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ConfigError(`Failed to parse audit file: ${filePath}`, cause);
  }

  const result = auditReportSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid audit report at ${filePath}: ${issues}`);
  }

  return result.data;
}

export { readAuditReport };
