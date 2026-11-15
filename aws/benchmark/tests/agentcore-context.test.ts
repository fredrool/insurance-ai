import { describe, expect, it } from 'vitest';

import { resolveGatewayToolName } from '../shared/src/agentcore-context.js';

describe('resolveGatewayToolName', () => {
  it('strips target prefix before ___', () => {
    const context = {
      clientContext: {
        custom: {
          bedrockAgentCoreToolName:
            'insurance-ai-benchmark-crm-getCustomerByPolicy___getCustomerByPolicy',
        },
      },
    };

    expect(resolveGatewayToolName(context as never)).toBe(
      'getCustomerByPolicy',
    );
  });
});