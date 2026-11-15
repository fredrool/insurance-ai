export function resolveGatewayMcpUrl(raw: string): URL {
  const trimmed = raw.trim();
  const url = new URL(trimmed.endsWith('/mcp') ? trimmed : `${trimmed.replace(/\/$/, '')}/mcp`);
  return url;
}

export const AGENTCORE_GATEWAY_PROTOCOL_VERSIONS = [
  '2025-03-26',
  '2025-06-18',
  '2025-11-25',
] as const;