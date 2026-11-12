import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "mcp/claims/server.ts"],
});

const client = new Client({
  name: "insurance-ai-client",
  version: "1.0.0",
});

try {
  // 1. Connect to MCP server
  await client.connect(transport);
  console.log("Connected to MCP Claims server");

  // 2. Discover available tools
  const { tools } = await client.listTools();

  console.log("\nAvailable tools:");
  for (const tool of tools) {
    console.log(`- ${tool.name}: ${tool.description}`);
  }

  // 3. Execute tool
  const result = await client.callTool({
    name: "getClaimStatus",
    arguments: {
      claimId: "CLM-001",
    },
  });

  console.log("\nTool result:");
  console.dir(result, { depth: null });
} finally {
  await client.close();
}