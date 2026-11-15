import { describe, expect, it } from 'vitest';

import { handler } from '../lambdas/crm/src/handler.js';

function gatewayContext(toolName: string) {
  return {
    clientContext: {
      custom: {
        bedrockAgentCoreToolName: `insurance-ai-benchmark-crm-getCustomerByPolicy___${toolName}`,
      },
    },
  };
}

describe('crm Lambda handler (Gateway event shape)', () => {
  it('getCustomerByPolicy returns CUS-1001 for POL-001', async () => {
    const result = await handler(
      { policyId: 'POL-001' },
      gatewayContext('getCustomerByPolicy') as never,
    );
    expect(result).toMatchObject({
      id: 'CUS-1001',
      displayName: 'Alex Martin',
      policyIds: ['POL-001'],
    });
  });
});