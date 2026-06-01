import type { z } from "zod";
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

// Parameterized over the full ZodObject type so each call site is fully typed from its
// inputSchema. The SDK callback receives ShapeOutput<shape>, which is structurally
// equivalent to z.infer<TSchema> at runtime; the cast bridges the two separate
// inference paths so the helper avoids any/unknown at every call site.
function registerMcpTool<TSchema extends z.ZodObject>(
  server: McpServer,
  tool: {
    name: string;
    description: string;
    inputSchema: TSchema;
    handler: (input: z.infer<TSchema>) => string | Promise<string>;
  },
): void {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.inputSchema.shape },
    async (params) => {
      try {
        const result = await Promise.resolve(tool.handler(params as z.infer<TSchema>));
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "foxhole",
    version: readFoxholeVersion(),
  });

  registerMcpTool(server, runFullAuditTool);
  registerMcpTool(server, runAccessibilityAuditTool);
  registerMcpTool(server, runPerformanceAuditTool);
  registerMcpTool(server, getPrioritizedFixesTool);
  registerMcpTool(server, compareRunsTool);
  registerMcpTool(server, generateReportTool);

  return server;
}

async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { createMcpServer, startMcpServer, errorResult };
