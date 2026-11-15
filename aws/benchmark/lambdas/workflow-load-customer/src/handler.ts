import type { Handler } from 'aws-lambda';

import type { CrmCustomer } from '../../../shared/src/crm.js';
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
  const policyId = state.claim?.policyId;
  if (!policyId) {
    return {
      ...state,
      customer: null,
      warnings: [
        ...state.warnings,
        'Skipping CRM lookup because the claim record is unavailable.',
      ],
    };
  }

  const gatewayUrl = requiredEnv('GATEWAY_MCP_URL');
  const region = process.env.AWS_REGION ?? requiredEnv('BEDROCK_AWS_REGION');
  const session = await GatewayMcpSession.open(gatewayUrl, region);
  try {
    const raw = await session.callToolBySuffix('getCustomerByPolicy', {
      policyId,
    });
    const customer = parseJsonRecord<CrmCustomer>(raw);
    const warnings = [...state.warnings];
    if (!customer) {
      warnings.push(`No CRM customer linked to policy ${policyId}.`);
    }
    return {
      ...state,
      customer,
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