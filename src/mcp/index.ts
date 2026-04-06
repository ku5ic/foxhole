import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { runFullAuditTool } from "./tools/run_full_audit.js";
import { runAccessibilityAuditTool } from "./tools/run_accessibility_audit.js";
import { runPerformanceAuditTool } from "./tools/run_performance_audit.js";
import { getPrioritizedFixesTool } from "./tools/get_prioritized_fixes.js";
import { compareRunsTool } from "./tools/compare_runs.js";
import { generateReportTool } from "./tools/generate_report.js";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "foxhole",
    version: "0.1.0",
  });

  server.registerTool(
    runFullAuditTool.name,
    {
      description: runFullAuditTool.description,
      inputSchema: runFullAuditTool.inputSchema.shape,
    },
    async (params) => {
      const result = await runFullAuditTool.handler(params);
      return { content: [{ type: "text", text: result }] };
    },
  );

  server.registerTool(
    runAccessibilityAuditTool.name,
    {
      description: runAccessibilityAuditTool.description,
      inputSchema: runAccessibilityAuditTool.inputSchema.shape,
    },
    async (params) => {
      const result = await runAccessibilityAuditTool.handler(params);
      return { content: [{ type: "text", text: result }] };
    },
  );

  server.registerTool(
    runPerformanceAuditTool.name,
    {
      description: runPerformanceAuditTool.description,
      inputSchema: runPerformanceAuditTool.inputSchema.shape,
    },
    async (params) => {
      const result = await runPerformanceAuditTool.handler(params);
      return { content: [{ type: "text", text: result }] };
    },
  );

  server.registerTool(
    getPrioritizedFixesTool.name,
    {
      description: getPrioritizedFixesTool.description,
      inputSchema: getPrioritizedFixesTool.inputSchema.shape,
    },
    (params) => {
      const result = getPrioritizedFixesTool.handler(params);
      return { content: [{ type: "text", text: result }] };
    },
  );

  server.registerTool(
    compareRunsTool.name,
    {
      description: compareRunsTool.description,
      inputSchema: compareRunsTool.inputSchema.shape,
    },
    (params) => {
      const result = compareRunsTool.handler(params);
      return { content: [{ type: "text", text: result }] };
    },
  );

  server.registerTool(
    generateReportTool.name,
    {
      description: generateReportTool.description,
      inputSchema: generateReportTool.inputSchema.shape,
    },
    (params) => {
      const result = generateReportTool.handler(params);
      return { content: [{ type: "text", text: result }] };
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
