import { describe, expect, it } from 'vitest';

import { resolveGatewayMcpUrl } from '../clients/gateway-url.js';

describe('resolveGatewayMcpUrl', () => {
  it('appends /mcp when missing', () => {
    expect(resolveGatewayMcpUrl('https://gw.example/mcp').pathname).toBe('/mcp');
    expect(
      resolveGatewayMcpUrl('https://abc.gateway.bedrock-agentcore.us-east-1.amazonaws.com')
        .toString(),
    ).toMatch(/\/mcp$/);
  });

  it('does not double /mcp', () => {
    expect(
      resolveGatewayMcpUrl(
        'https://abc.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp',
      ).pathname,
    ).toBe('/mcp');
  });
});