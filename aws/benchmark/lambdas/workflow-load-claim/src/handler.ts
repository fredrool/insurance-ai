import type { Handler } from 'aws-lambda';

import type { InsuranceClaim } from '../../../shared/src/claims.js';
import { GatewayMcpSession } from '../../../shared/src/gateway-mcp-session.js';
import { parseJsonRecord } from '../../../shared/src/parse-json.js';
import type { WorkflowState } from '../../../shared/src/workflow-state.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const handler: Handler<WorkflowState, WorkflowState> = async (state) => {
  const gatewayUrl = requiredEnv('GATEWAY_MCP_URL');
  const region = process.env.AWS_REGION ?? requiredEnv('BEDROCK_AWS_REGION');
  const session = await GatewayMcpSession.open(gatewayUrl, region);
  try {
    const raw = await session.callToolBySuffix('getClaimStatus', {
      claimId: state.claimId,
    });
    const claim = parseJsonRecord<InsuranceClaim>(raw);
    const warnings = [...state.warnings];
    if (!claim) {
      warnings.push(`No claim found for ID ${state.claimId}.`);
    }
    return {
      ...state,
      claim,
      warnings,
      metrics: {
        ...state.metrics,
        mcpCalls: state.metrics.mcpCalls + 1,
      },
    };
  } finally {
    await session.close();
  }
};