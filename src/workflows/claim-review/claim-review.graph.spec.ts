import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { vi } from 'vitest';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';

import { buildClaimReviewGraph, Command } from './claim-review.graph.js';
import { initialClaimReviewState } from './claim-review.state.js';

describe('claim review HITL StateGraph', () => {
  const sampleClaim: InsuranceClaim = {
    id: 'CLM-001',
    policyId: 'POL-001',
    description: 'Water damage in basement',
    status: 'under_review',
    submittedAt: '2026-10-15',
  };

  function createGraph() {
    const invokeMcpTool = vi.fn(async (toolName: string) => {
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

    const embed = vi.fn(async () => [0.2, 0.4]);
    const searchGlobal = vi.fn(async () => [
      {
        documentName: 'home-insurance.pdf',
        documentVersion: '2.1.0',
        pageNumber: 5,
        chunkIndex: 3,
        content: 'Gradual seepage may be excluded.',
        similarity: 0.88,
      },
    ]);

    const model = {
      invoke: vi.fn(async () => ({
        content:
          'Draft recommendation: request more documentation on sudden vs gradual water damage before approving. [SRC-001]',
        usage_metadata: { input_tokens: 90, output_tokens: 35 },
      })),
    };

    const checkpointer = new MemorySaver();
    const graph = buildClaimReviewGraph(
      {
        invokeMcpTool,
        embeddings: { embed } as never,
        retriever: { searchGlobal } as never,
        model: model as never,
      },
      checkpointer,
    );

    return { graph, invokeMcpTool, embed, searchGlobal, model, checkpointer };
  }

  const threadId = 'claim-review:test-thread';

  it('interrupts for human approval then resumes approved without redoing MCP/LLM', async () => {
    const { graph, invokeMcpTool, embed, model } = createGraph();

    const started = await graph.invoke(
      initialClaimReviewState(
        'CLM-001',
        'Review claim CLM-001 and recommend whether it should be approved.',
      ),
      { configurable: { thread_id: threadId } },
    );

    expect(graph.isInterrupted(started)).toBe(true);
    expect(invokeMcpTool).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(model.invoke).toHaveBeenCalledTimes(1);

    const paused = await graph.getState({ configurable: { thread_id: threadId } });
    const pausedState = paused.values as {
      recommendation: string;
      mcpCalls: number;
      llmCalls: number;
    };
    expect(pausedState.recommendation).toContain('Draft recommendation');

    const completed = await graph.invoke(
      new Command({
        resume: { approved: true, comment: 'Approved by claims adjuster' },
      }),
      { configurable: { thread_id: threadId } },
    );

    expect(graph.isInterrupted(completed)).toBe(false);
    expect(invokeMcpTool).toHaveBeenCalledTimes(2);
    expect(model.invoke).toHaveBeenCalledTimes(1);

    const finalState = (await graph.getState({ configurable: { thread_id: threadId } }))
      .values as {
      finalStatus: string;
      humanDecision?: { approved: boolean; comment?: string };
    };
    expect(finalState.finalStatus).toBe('approved');
    expect(finalState.humanDecision?.approved).toBe(true);
    expect(finalState.humanDecision?.comment).toBe('Approved by claims adjuster');
  });

  it('persists checkpoint in MemorySaver across a new compiled graph instance', async () => {
    const checkpointer = new MemorySaver();
    const model = {
      invoke: vi.fn(async () => ({
        content: 'Draft recommendation for restart test',
        usage_metadata: { input_tokens: 1, output_tokens: 1 },
      })),
    };
    const graphV1 = buildClaimReviewGraph(
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
        retriever: { searchGlobal: vi.fn().mockResolvedValue([]) } as never,
        model: model as never,
      },
      checkpointer,
    );

    await graphV1.invoke(initialClaimReviewState('CLM-001', 'Review CLM-001'), {
      configurable: { thread_id: 'claim-review:restart-demo' },
    });

    const graphV2 = buildClaimReviewGraph(
      {
        invokeMcpTool: vi.fn().mockRejectedValue(new Error('MCP should not run on resume')),
        embeddings: { embed: vi.fn().mockRejectedValue(new Error('no embed on resume')) } as never,
        retriever: { searchGlobal: vi.fn().mockRejectedValue(new Error('no RAG on resume')) } as never,
        model: { invoke: vi.fn().mockRejectedValue(new Error('no LLM on resume')) } as never,
      },
      checkpointer,
    );

    const resumed = await graphV2.invoke(
      new Command({ resume: { approved: false, comment: 'Insufficient proof' } }),
      { configurable: { thread_id: 'claim-review:restart-demo' } },
    );

    expect(graphV2.isInterrupted(resumed)).toBe(false);
    const values = (await graphV2.getState({
      configurable: { thread_id: 'claim-review:restart-demo' },
    })).values as { finalStatus: string };
    expect(values.finalStatus).toBe('rejected');
  });

  it('rejects missing claim without LLM or interrupt', async () => {
    const checkpointer = new MemorySaver();
    const model = { invoke: vi.fn() };
    const graph = buildClaimReviewGraph(
      {
        invokeMcpTool: vi.fn().mockResolvedValue(JSON.stringify(null)),
        embeddings: { embed: vi.fn() } as never,
        retriever: { searchGlobal: vi.fn() } as never,
        model: model as never,
      },
      checkpointer,
    );

    const result = await graph.invoke(
      initialClaimReviewState('CLM-999', 'Review missing claim'),
      { configurable: { thread_id: 'claim-review:missing' } },
    );

    expect(graph.isInterrupted(result)).toBe(false);
    expect(model.invoke).not.toHaveBeenCalled();
    const values = (await graph.getState({
      configurable: { thread_id: 'claim-review:missing' },
    })).values as { finalStatus: string; warnings: string[] };
    expect(values.finalStatus).toBe('failed');
    expect(values.warnings.some((w) => w.includes('Cannot request human approval'))).toBe(
      true,
    );
  });

  it('records rejection branch after resume', async () => {
    const { graph } = createGraph();
    await graph.invoke(
      initialClaimReviewState('CLM-001', 'Review CLM-001'),
      { configurable: { thread_id: 'claim-review:reject' } },
    );

    await graph.invoke(
      new Command({ resume: { approved: false, comment: 'Denied' } }),
      { configurable: { thread_id: 'claim-review:reject' } },
    );

    const values = (await graph.getState({
      configurable: { thread_id: 'claim-review:reject' },
    })).values as { finalStatus: string };
    expect(values.finalStatus).toBe('rejected');
  });
});