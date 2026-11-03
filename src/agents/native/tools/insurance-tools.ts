import Anthropic from '@anthropic-ai/sdk';

export const insuranceTools: Anthropic.Tool[] = [
  {
    name: 'getPolicyDetails',
    description:
      'Retrieve details of an insurance policy by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        policyId: {
          type: 'string',
          description: 'Insurance policy ID, e.g. POL-001',
        },
      },
      required: ['policyId'],
    },
  },
  {
    name: 'getClaimStatus',
    description:
      'Retrieve the current status of an insurance claim.',
    input_schema: {
      type: 'object',
      properties: {
        claimId: {
          type: 'string',
          description: 'Insurance claim ID, e.g. CLM-001',
        },
      },
      required: ['claimId'],
    },
  },
];
