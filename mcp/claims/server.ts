import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

import { InsuranceService } from '../../src/insurance/insurance.service.js';

const insuranceService = new InsuranceService();

const server = new McpServer({
  name: 'insurance-claims',
  version: '1.0.0',
});

server.registerTool(
  'getClaimStatus',
  {
    description: 'Retrieve the status of an insurance claim.',
    inputSchema: z.object({
      claimId: z.string().describe('Claim ID, e.g. CLM-001'),
    }),
  },
  async ({ claimId }) => {
    const claim = insuranceService.getClaimStatus(claimId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(claim, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  'getPolicyDetails',
  {
    description: 'Retrieve details of an insurance policy.',
    inputSchema: z.object({
      policyId: z.string().describe('Policy ID, e.g. POL-001'),
    }),
  },
  async ({ policyId }) => {
    const policy = insuranceService.getPolicyDetails(policyId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(policy, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('MCP Claims server running');
