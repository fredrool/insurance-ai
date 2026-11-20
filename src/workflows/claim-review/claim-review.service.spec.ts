import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { vi } from 'vitest';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';

import { buildClaimReviewGraph } from './claim-review.graph.js';
import { ClaimReviewWorkflowService } from './claim-review.service.js';
import { initialClaimReviewState } from './claim-review.state.js';

const sampleClaim: InsuranceClaim = {
  id: 'CLM-001',
  policyId: 'POL-001',
  description: 'Water damage',
  status: 'under_review',
  submittedAt: '2026-10-15',
};

function buildTestService(checkpointer: MemorySaver) {
  const model = {
    invoke: vi.fn(async () => ({
      content: 'Draft: approve with conditions [SRC-001]',
      usage_metadata: { input_tokens: 10, output_tokens: 8 },
    })),
  };

  const graph = buildClaimReviewGraph(
    {
      invokeMcpTool: vi.fn(async (toolName: string) => {
        if (toolName === 'claims_getClaimStatus') {
          return JSON.stringify(sampleClaim);
        }
        return JSON.stringify({
          id: 'CUS-1001',
          displayName: 'Alex Martin',
          email: 'a@example.com',
          policyIds: ['POL-001'],
        });
      }),
      embeddings: { embed: vi.fn().mockResolvedValue([0.2]) } as never,
      retriever: {
        searchGlobal: vi.fn().mockResolvedValue([
          {
            id: 'SRC-001',
            documentName: 'home.pdf',
            documentVersion: '1',
            pageNumber: 1,
            chunkIndex: 0,
            content: 'text',
            similarity: 0.9,
          },
        ]),
      } as never,
      model: model as never,
    },
    checkpointer,
  );

  const service = Object.create(ClaimReviewWorkflowService.prototype) as ClaimReviewWorkflowService;
  Object.assign(service, {
    graph,
    resumeInFlight: new Map(),
  });
  return service;
}

describe('ClaimReviewWorkflowService', () => {
  it('starts with awaiting_approval status', async () => {
    const service = buildTestService(new MemorySaver());
    const response = await service.start({
      claimId: 'CLM-001',
      question: 'Review claim CLM-001 and recommend whether it should be approved.',
    });

    expect(response.status).toBe('awaiting_approval');
    if (response.status !== 'awaiting_approval') {
      return;
    }
    expect(response.threadId).toMatch(/^claim-review:/);
    expect(response.recommendation).toContain('Draft');
  });

  it('resumes approved and marks simulated completion', async () => {
    const checkpointer = new MemorySaver();
    const service = buildTestService(checkpointer);
    const started = await service.start({
      claimId: 'CLM-001',
      question: 'Review claim CLM-001',
    });
    if (started.status !== 'awaiting_approval') {
      throw new Error('expected interrupt');
    }

    const done = await service.resume({
      threadId: started.threadId,
      approved: true,
      comment: 'Approved by claims adjuster',
    });

    expect(done.status).toBe('completed');
    expect(done.simulated).toBe(true);
    expect(done.decision).toBe('approved');
  });

  it('rejects unknown thread on resume', async () => {
    const service = buildTestService(new MemorySaver());
    await expect(
      service.resume({
        threadId: 'claim-review:does-not-exist',
        approved: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate resume after completion', async () => {
    const service = buildTestService(new MemorySaver());
    const started = await service.start({
      claimId: 'CLM-001',
      question: 'Review claim CLM-001',
    });
    if (started.status !== 'awaiting_approval') {
      throw new Error('expected interrupt');
    }

    await service.resume({
      threadId: started.threadId,
      approved: false,
      comment: 'Denied',
    });

    await expect(
      service.resume({
        threadId: started.threadId,
        approved: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid thread prefix', async () => {
    const service = buildTestService(new MemorySaver());
    await expect(
      service.resume({ threadId: 'bedrock:chat-1', approved: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});