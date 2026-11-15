/**
 * Phase 1 validation client — real MCP over AgentCore Gateway (Streamable HTTP + IAM SigV4).
 *
 * Requires:
 *   AGENTCORE_GATEWAY_MCP_URL  e.g. https://..../mcp  (terraform output gateway_mcp_url)
 *   AWS_REGION                 default us-east-1
 *
 * Caller identity needs bedrock-agentcore:InvokeGateway on the gateway ARN.
 */
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { getClaimStatus } from '../shared/src/claims.js';
import { getCustomerByPolicy } from '../shared/src/crm.js';
import {
  AGENTCORE_GATEWAY_PROTOCOL_VERSIONS,
  resolveGatewayMcpUrl,
} from './gateway-url.js';
import { createSigV4Fetch } from './sigv4-fetch.js';

function parseToolJson(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    return result;
  }
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }
  const first = content[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'type' in first &&
    first.type === 'text' &&
    'text' in first &&
    typeof first.text === 'string'
  ) {
    try {
      return JSON.parse(first.text);
    } catch {
      return first.text;
    }
  }
  return result;
}

function findToolBySuffix(
  tools: { name: string; description?: string }[],
  suffix: string,
): string | undefined {
  const exact = tools.find((tool) => tool.name === suffix);
  if (exact) return exact.name;
  return tools.find((tool) => tool.name.endsWith(suffix))?.name;
}

async function main(): Promise<void> {
  const gatewayUrl = process.env.AGENTCORE_GATEWAY_MCP_URL?.trim();
  if (!gatewayUrl) {
    throw new Error(
      'Set AGENTCORE_GATEWAY_MCP_URL to the Gateway MCP endpoint (…/mcp).',
    );
  }

  const region = process.env.AWS_REGION?.trim() || 'us-east-1';
  const mcpUrl = resolveGatewayMcpUrl(gatewayUrl);

  // AgentCore Gateway speaks 2025-era MCP (initialize/tools/*). MCP Client v2
  // defaults to modern negotiation (`server/discover`), which Gateway rejects
  // with: "Http operation is not supported for gateway protocol type MCP".
  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    fetch: createSigV4Fetch(region),
    protocolVersion: AGENTCORE_GATEWAY_PROTOCOL_VERSIONS[0],
  });

  const client = new Client(
    {
      name: 'insurance-ai-benchmark-phase1',
      version: '1.0.0',
    },
    {
      versionNegotiation: { mode: 'legacy' },
      supportedProtocolVersions: [...AGENTCORE_GATEWAY_PROTOCOL_VERSIONS],
    },
  );

  const expectedClaim = getClaimStatus('CLM-001');
  const expectedCustomer = getCustomerByPolicy('POL-001');

  try {
    await client.connect(transport);
    console.log(`Connected (IAM SigV4, legacy MCP) to ${mcpUrl.toString()}`);

    const { tools } = await client.listTools();
    console.log('\nDiscovered MCP tools (names from Gateway):');
    for (const tool of tools) {
      console.log(`  - ${tool.name}`);
    }

    const claimToolName = findToolBySuffix(tools, 'getClaimStatus');
    const crmToolName = findToolBySuffix(tools, 'getCustomerByPolicy');

    if (!claimToolName) {
      throw new Error(
        'No tool ending with getClaimStatus found via tools/list.',
      );
    }
    if (!crmToolName) {
      throw new Error(
        'No tool ending with getCustomerByPolicy found via tools/list.',
      );
    }

    console.log(`\nCalling ${claimToolName} …`);
    const claimResult = await client.callTool({
      name: claimToolName,
      arguments: { claimId: 'CLM-001' },
    });
    const claimPayload = parseToolJson(claimResult);
    console.log('Claim MCP result:', JSON.stringify(claimPayload, null, 2));

    console.log(`\nCalling ${crmToolName} …`);
    const crmResult = await client.callTool({
      name: crmToolName,
      arguments: { policyId: 'POL-001' },
    });
    const crmPayload = parseToolJson(crmResult);
    console.log('CRM MCP result:', JSON.stringify(crmPayload, null, 2));

    console.log('\nLocal fixture baseline (not MCP):');
    console.log('  claim CLM-001:', JSON.stringify(expectedClaim));
    console.log('  customer POL-001:', JSON.stringify(expectedCustomer));

    const claimMatch =
      JSON.stringify(claimPayload) === JSON.stringify(expectedClaim);
    const crmMatch =
      JSON.stringify(crmPayload) === JSON.stringify(expectedCustomer);

    if (!claimMatch || !crmMatch) {
      console.error('\nMismatch between Gateway MCP payloads and local fixtures.');
      process.exitCode = 1;
      return;
    }

    console.log('\nPhase 1 check: MCP tools/list + tools/call match local fixtures.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});