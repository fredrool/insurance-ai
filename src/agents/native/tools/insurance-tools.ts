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
  {
    name: 'searchInsuranceDocuments',
    description:
      'Search fictional ABC Assurances policy documents by semantic similarity. Returns relevant passages and source metadata as JSON only (no generated answer).',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in natural language',
        },
        documentNames: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional PDF document names. If omitted, search globally across all indexed documents.',
        },
        topK: {
          type: 'number',
          description:
            'Maximum results globally, or per document when documentNames is set (default 5, max 20).',
        },
      },
      required: ['query'],
    },
  },
];
