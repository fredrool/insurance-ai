import { describe, expect, it } from 'vitest';

import {
  extractTurnMetrics,
  extractTurnObservability,
  sliceTurnMessages,
} from './bedrock-invocation.util.js';

describe('bedrock invocation utils', () => {
  it('slices only messages produced during the current turn', () => {
    const all = [
      { role: 'user', content: 'old' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'new question' },
      { role: 'assistant', content: 'new answer', tool_calls: [] },
    ];

    expect(sliceTurnMessages(all, 2)).toEqual(all.slice(2));
  });

  it('extracts tool calls and document sources from tool messages only', () => {
    const turnMessages = [
      {
        type: 'ai',
        tool_calls: [
          {
            name: 'searchInsuranceDocuments',
            args: { query: 'water damage', documentNames: ['home-insurance.pdf'] },
          },
          { name: 'getClaimStatus', args: { claimId: 'CLM-001' } },
        ],
      },
      {
        type: 'tool',
        name: 'searchInsuranceDocuments',
        content: JSON.stringify({
          query: 'water damage',
          sources: [
            {
              id: 'SRC-001',
              documentName: 'home-insurance.pdf',
              documentVersion: '2.1.0',
              pageNumber: 5,
              chunkIndex: 12,
              similarity: 0.91,
              content: 'Section 5.3.1 excludes gradual damage.',
            },
          ],
        }),
      },
      {
        type: 'tool',
        name: 'getClaimStatus',
        content: JSON.stringify({ id: 'CLM-001', status: 'under_review' }),
      },
      {
        type: 'ai',
        content: 'According to [SRC-001] home-insurance.pdf v2.1.0 page 5...',
      },
    ];

    const { toolCalls, sources } = extractTurnObservability(turnMessages);

    expect(toolCalls).toEqual([
      {
        name: 'searchInsuranceDocuments',
        args: {
          query: 'water damage',
          documentNames: ['home-insurance.pdf'],
        },
      },
      { name: 'getClaimStatus', args: { claimId: 'CLM-001' } },
    ]);
    expect(sources).toEqual([
      {
        id: 'SRC-001',
        documentName: 'home-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 5,
        chunkIndex: 12,
        similarity: 0.91,
      },
    ]);
  });

  it('extracts llm and MCP metrics from the current turn only', () => {
    const priorTurn = [
      {
        type: 'ai',
        content: 'old',
        usage_metadata: { input_tokens: 999, output_tokens: 999 },
      },
      {
        type: 'tool',
        name: 'claims_getClaimStatus',
        content: '{}',
      },
    ];

    const currentTurn = [
      {
        type: 'ai',
        tool_calls: [{ name: 'claims_getClaimStatus', args: { claimId: 'CLM-001' } }],
        usage_metadata: { input_tokens: 100, output_tokens: 20 },
      },
      {
        type: 'tool',
        name: 'claims_getClaimStatus',
        content: JSON.stringify({ id: 'CLM-001', policyId: 'POL-001' }),
      },
      {
        type: 'tool',
        name: 'searchInsuranceDocuments',
        content: JSON.stringify({ query: 'water', sources: [] }),
      },
      {
        type: 'ai',
        content: 'Summary.',
        usage_metadata: { input_tokens: 200, output_tokens: 50 },
      },
    ];

    const all = [...priorTurn, ...currentTurn];
    const turnMessages = sliceTurnMessages(all, priorTurn.length);
    const metrics = extractTurnMetrics(turnMessages);

    expect(metrics).toEqual({
      llmCalls: 2,
      mcpCalls: 1,
      inputTokens: 300,
      outputTokens: 70,
    });
  });
});
