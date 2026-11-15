import type { Context } from 'aws-lambda';

import { resolveGatewayToolName } from '../../../shared/src/agentcore-context.js';
import { getClaimStatus, getPolicyDetails } from '../../../shared/src/claims.js';

export async function handler(
  event: Record<string, unknown>,
  context: Context,
): Promise<unknown> {
  const toolName = resolveGatewayToolName(context);

  switch (toolName) {
    case 'getClaimStatus':
      return getClaimStatus(String(event.claimId ?? ''));
    case 'getPolicyDetails':
      return getPolicyDetails(String(event.policyId ?? ''));
    default:
      return {
        error: 'UNKNOWN_TOOL',
        message: `Unsupported claims tool: ${toolName || '(missing)'}`,
      };
  }
}