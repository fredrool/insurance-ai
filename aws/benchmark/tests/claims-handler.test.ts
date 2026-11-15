import { describe, expect, it } from 'vitest';

import { handler } from '../lambdas/claims/src/handler.js';

function gatewayContext(toolName: string) {
  return {
    clientContext: {
      custom: {
        bedrockAgentCoreToolName: `insurance-ai-benchmark-claims-getClaimStatus___${toolName}`,
      },
    },
  };
}

describe('claims Lambda handler (Gateway event shape)', () => {
  it('getClaimStatus returns CLM-001', async () => {
    const result = await handler(
      { claimId: 'CLM-001' },
      gatewayContext('getClaimStatus') as never,
    );
    expect(result).toMatchObject({
      id: 'CLM-001',
      policyId: 'POL-001',
      status: 'under_review',
    });
  });

  it('getPolicyDetails returns POL-001', async () => {
    const result = await handler(
      { policyId: 'POL-001' },
      gatewayContext('getPolicyDetails') as never,
    );
    expect(result).toMatchObject({
      id: 'POL-001',
      type: 'home',
    });
  });
});