import type { Context } from 'aws-lambda';

import { resolveGatewayToolName } from '../../../shared/src/agentcore-context.js';
import {
  getCustomerByPolicy,
  getCustomerDetails,
} from '../../../shared/src/crm.js';

export async function handler(
  event: Record<string, unknown>,
  context: Context,
): Promise<unknown> {
  const toolName = resolveGatewayToolName(context);

  switch (toolName) {
    case 'getCustomerDetails':
      return getCustomerDetails(String(event.customerId ?? ''));
    case 'getCustomerByPolicy':
      return getCustomerByPolicy(String(event.policyId ?? ''));
    default:
      return {
        error: 'UNKNOWN_TOOL',
        message: `Unsupported CRM tool: ${toolName || '(missing)'}`,
      };
  }
}