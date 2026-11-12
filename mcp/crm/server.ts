import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

import {
  getCustomerByPolicy,
  getCustomerDetails,
} from './crm.data.js';

const server = new McpServer({
  name: 'insurance-crm',
  version: '1.0.0',
});

server.registerTool(
  'getCustomerDetails',
  {
    description:
      'Retrieve fictional CRM profile and linked policy IDs for a customer.',
    inputSchema: z.object({
      customerId: z.string().describe('Customer ID, e.g. CUS-1001'),
    }),
  },
  async ({ customerId }) => {
    const customer = getCustomerDetails(customerId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(customer, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  'getCustomerByPolicy',
  {
    description:
      'Look up the fictional CRM customer linked to an insurance policy ID.',
    inputSchema: z.object({
      policyId: z.string().describe('Policy ID shared with Claims, e.g. POL-001'),
    }),
  },
  async ({ policyId }) => {
    const customer = getCustomerByPolicy(policyId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(customer, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('MCP CRM server running');
