import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readAuditReport } from "../../src/audit/read-report.js";
import { ConfigError } from "../../src/errors.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/sample-report.json");

describe("readAuditReport", () => {
  it("reads and parses the sample-report fixture without throwing", async () => {
    const report = await readAuditReport(FIXTURE);
    expect(report.version).toBe(1);
    expect(report.pages).toHaveLength(1);
  });

  it("throws ConfigError when the file does not exist", async () => {
    await expect(readAuditReport("/nonexistent/path/report.json")).rejects.toThrow(ConfigError);
  });

  it("throws ConfigError with a descriptive message when the file is not found", async () => {
    await expect(readAuditReport("/nonexistent/path/report.json")).rejects.toThrow(
      /Audit file not found/,
    );
  });

  it("throws ConfigError when the file contains malformed JSON", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = path.resolve(__dirname, "../fixtures/__tmp-bad.json");
    writeFileSync(tmpPath, "{ not valid json");
    try {
      await expect(readAuditReport(tmpPath)).rejects.toThrow(ConfigError);
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it("throws ConfigError when the JSON does not match AuditReport schema", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = path.resolve(__dirname, "../fixtures/__tmp-wrong-schema.json");
    writeFileSync(tmpPath, JSON.stringify({ version: 1, wrong: "shape" }));
    try {
      await expect(readAuditReport(tmpPath)).rejects.toThrow(ConfigError);
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it("ConfigError message names the file path when schema validation fails", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = path.resolve(__dirname, "../fixtures/__tmp-schema-error.json");
    writeFileSync(tmpPath, JSON.stringify({ version: 1, wrong: "shape" }));
    try {
      const err = await readAuditReport(tmpPath).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).message).toContain(tmpPath);
    } finally {
      unlinkSync(tmpPath);
    }
  });
});

// Verify the sample fixture still parses correctly after fixture updates.
describe("sample-report fixture round-trip", () => {
  it("raw JSON passes auditReportSchema", async () => {
    const { auditReportSchema } = await import("../../src/types/schema.js");
    const raw = readFileSync(FIXTURE, "utf8");
    const result = auditReportSchema.safeParse(JSON.parse(raw));
    expect(result.success).toBe(true);
  });
});
