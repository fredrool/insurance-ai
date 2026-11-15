import { vi } from 'vitest';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';

import { buildClaimLookupGraph } from './claim-lookup.graph.js';

describe('claim lookup StateGraph', () => {
  const sampleClaim: InsuranceClaim = {
    id: 'CLM-001',
    policyId: 'POL-001',
    description: 'Water damage in basement',
    status: 'under_review',
    submittedAt: '2026-10-15',
  };

  it('runs nodes in order and returns answer with metrics', async () => {
    const callOrder: string[] = [];

    const invokeMcpTool = vi.fn(async (toolName: string) => {
      callOrder.push(toolName);
      if (toolName === 'claims_getClaimStatus') {
        return JSON.stringify(sampleClaim);
      }
      if (toolName === 'crm_getCustomerByPolicy') {
        return JSON.stringify({
          id: 'CUS-1001',
          displayName: 'Alex Martin',
          email: 'alex.martin@example.abc-assurances.ca',
          policyIds: ['POL-001'],
        });
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const embed = vi.fn(async () => [0.1, 0.2]);
    const searchGlobal = vi.fn(async () => [
      {
        documentName: 'home-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 5,
        chunkIndex: 3,
        content: 'Water damage exclusions apply to gradual seepage.',
        similarity: 0.91,
      },
    ]);

    const model = {
      invoke: vi.fn(async () => ({
        content: 'Alex Martin owns POL-001; water damage is under review.',
        usage_metadata: { input_tokens: 120, output_tokens: 45 },
      })),
    };

    const graph = buildClaimLookupGraph({
      invokeMcpTool,
      embeddings: { embed } as never,
      retriever: { searchGlobal } as never,
      model: model as never,
    });

    const result = await graph.invoke({
      claimId: 'CLM-001',
      question:
        'Identify the customer and explain clauses for the water damage.',
      claim: null,
      customer: null,
      sources: [],
      warnings: [],
      answer: '',
      mcpCalls: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(callOrder).toEqual([
      'claims_getClaimStatus',
      'crm_getCustomerByPolicy',
    ]);
    expect(embed).toHaveBeenCalledOnce();
    expect(searchGlobal).toHaveBeenCalledOnce();
    expect(model.invoke).toHaveBeenCalledOnce();

    expect(result.claim).toEqual(sampleClaim);
    expect(result.customer?.id).toBe('CUS-1001');
    expect(result.sources).toHaveLength(1);
    expect(result.answer).toContain('water damage');
    expect(result.mcpCalls).toBe(2);
    expect(result.llmCalls).toBe(1);
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(45);
  });

  it('handles missing claim without CRM call and still generates an answer', async () => {
    const invokeMcpTool = vi.fn(async () => JSON.stringify(null));

    const model = {
      invoke: vi.fn(async () => ({
        content: 'The claim could not be found.',
        usage_metadata: { input_tokens: 40, output_tokens: 12 },
      })),
    };

    const graph = buildClaimLookupGraph({
      invokeMcpTool,
      embeddings: { embed: vi.fn().mockResolvedValue([0.1]) } as never,
      retriever: { searchGlobal: vi.fn().mockResolvedValue([]) } as never,
      model: model as never,
    });

    const result = await graph.invoke({
      claimId: 'CLM-999',
      question: 'What applies?',
      claim: null,
      customer: null,
      sources: [],
      warnings: [],
      answer: '',
      mcpCalls: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(invokeMcpTool).toHaveBeenCalledTimes(1);
    expect(result.customer).toBeNull();
    expect(result.warnings.some((w) => w.includes('No claim found'))).toBe(
      true,
    );
    expect(result.llmCalls).toBe(1);
  });
});