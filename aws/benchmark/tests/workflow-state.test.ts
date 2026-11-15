import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DEFAULT_QUESTION,
  initialWorkflowState,
  toWorkflowResponse,
} from '../shared/src/workflow-state.js';

describe('workflow state', () => {
  it('defaults metrics to zero', () => {
    const state = initialWorkflowState('CLM-001', BENCHMARK_DEFAULT_QUESTION);
    expect(state.metrics.mcpCalls).toBe(0);
    expect(state.metrics.llmCalls).toBe(0);
    expect(state.question).toContain('CLM-001');
  });

  it('strips source content from API response', () => {
    const state = initialWorkflowState('CLM-001', 'q');
    state.sources = [
      {
        id: 'SRC-001',
        documentName: 'Home',
        documentVersion: '1',
        pageNumber: 1,
        chunkIndex: 0,
        similarity: 0.9,
        content: 'secret chunk text',
      },
    ];
    state.answer = 'done';
    const response = toWorkflowResponse(state);
    expect(response.sources[0]).not.toHaveProperty('content');
    expect(response.sources[0]?.id).toBe('SRC-001');
    expect(response.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });
});