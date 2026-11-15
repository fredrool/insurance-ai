/** AgentCore Gateway MCP endpoint (always ends with `/mcp`). */
export function resolveGatewayMcpUrl(raw: string): URL {
  const trimmed = raw.trim();
  const url = new URL(trimmed.endsWith('/mcp') ? trimmed : `${trimmed.replace(/\/$/, '')}/mcp`);
  return url;
}

/** Protocol versions listed in terraform `supported_versions` for Phase 1. */
export const AGENTCORE_GATEWAY_PROTOCOL_VERSIONS = [
  '2025-03-26',
  '2025-06-18',
  '2025-11-25',
] as const;