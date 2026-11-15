import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import {
  AGENTCORE_GATEWAY_PROTOCOL_VERSIONS,
  resolveGatewayMcpUrl,
} from './gateway-url.js';
import { parseMcpToolJson } from './mcp-tool-parse.js';
import { createSigV4Fetch } from './sigv4-fetch.js';

export class GatewayMcpSession {
  private readonly client: Client;
  private readonly toolNames: Map<string, string> = new Map();

  private constructor(client: Client) {
    this.client = client;
  }

  static async open(gatewayMcpUrl: string, awsRegion: string): Promise<GatewayMcpSession> {
    const mcpUrl = resolveGatewayMcpUrl(gatewayMcpUrl);
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      fetch: createSigV4Fetch(awsRegion),
      protocolVersion: AGENTCORE_GATEWAY_PROTOCOL_VERSIONS[0],
    });
    const client = new Client(
      { name: 'insurance-ai-benchmark-workflow', version: '1.0.0' },
      {
        versionNegotiation: { mode: 'legacy' },
        supportedProtocolVersions: [...AGENTCORE_GATEWAY_PROTOCOL_VERSIONS],
      },
    );
    await client.connect(transport);
    const session = new GatewayMcpSession(client);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      for (const suffix of [
        'getClaimStatus',
        'getPolicyDetails',
        'getCustomerDetails',
        'getCustomerByPolicy',
      ]) {
        if (tool.name === suffix || tool.name.endsWith(suffix)) {
          session.toolNames.set(suffix, tool.name);
        }
      }
    }
    return session;
  }

  async callToolBySuffix(
    suffix: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const name = this.toolNames.get(suffix);
    if (!name) {
      throw new Error(`MCP tool not found for suffix ${suffix}`);
    }
    const result = await this.client.callTool({ name, arguments: args });
    return parseMcpToolJson(result);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}