import type { Command } from "commander";

import { formatErrorChain } from "../../errors.js";
import { startMcpServer } from "../../mcp/index.js";

function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Start the foxhole MCP server over stdio. Stays open until stdin closes.")
    .action(async () => {
      try {
        await startMcpServer();
      } catch (error) {
        process.stderr.write(`Unexpected error: ${formatErrorChain(error)}\n`);
        process.exit(2);
      }
    });
}

export { registerMcpCommand };
