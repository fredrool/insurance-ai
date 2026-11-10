import { describe, expect, it } from 'vitest';

import {
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
});
