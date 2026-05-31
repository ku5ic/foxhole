import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { formatErrorChain } from "../errors.js";
import { readFoxholeVersion } from "../version.js";
import { runFullAuditTool } from "./tools/run_full_audit.js";
import { runAccessibilityAuditTool } from "./tools/run_accessibility_audit.js";
import { runPerformanceAuditTool } from "./tools/run_performance_audit.js";
import { getPrioritizedFixesTool } from "./tools/get_prioritized_fixes.js";
import { compareRunsTool } from "./tools/compare_runs.js";
import { generateReportTool } from "./tools/generate_report.js";

function errorResult(error: unknown): { content: [{ type: "text"; text: string }] } {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: formatErrorChain(error) }) }],
  };
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "foxhole",
    version: readFoxholeVersion(),
  });

  server.registerTool(
    runFullAuditTool.name,
    {
      description: runFullAuditTool.description,
      inputSchema: runFullAuditTool.inputSchema.shape,
    },
    async (params) => {
      try {
        const result = await runFullAuditTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    runAccessibilityAuditTool.name,
    {
      description: runAccessibilityAuditTool.description,
      inputSchema: runAccessibilityAuditTool.inputSchema.shape,
    },
    async (params) => {
      try {
        const result = await runAccessibilityAuditTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    runPerformanceAuditTool.name,
    {
      description: runPerformanceAuditTool.description,
      inputSchema: runPerformanceAuditTool.inputSchema.shape,
    },
    async (params) => {
      try {
        const result = await runPerformanceAuditTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    getPrioritizedFixesTool.name,
    {
      description: getPrioritizedFixesTool.description,
      inputSchema: getPrioritizedFixesTool.inputSchema.shape,
    },
    (params) => {
      try {
        const result = getPrioritizedFixesTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    compareRunsTool.name,
    {
      description: compareRunsTool.description,
      inputSchema: compareRunsTool.inputSchema.shape,
    },
    (params) => {
      try {
        const result = compareRunsTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    generateReportTool.name,
    {
      description: generateReportTool.description,
      inputSchema: generateReportTool.inputSchema.shape,
    },
    (params) => {
      try {
        const result = generateReportTool.handler(params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { createMcpServer, startMcpServer };
