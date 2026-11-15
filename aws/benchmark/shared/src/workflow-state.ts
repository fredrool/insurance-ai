import type { InsuranceClaim } from './claims.js';
import type { CrmCustomer } from './crm.js';

export interface RagSourceSnapshot {
  id: string;
  documentName: string;
  documentVersion: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

export interface WorkflowMetrics {
  llmCalls: number;
  mcpCalls: number;
  embeddingCalls: number;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
}

export interface WorkflowState {
  claimId: string;
  question: string;
  startedAtMs: number;
  claim: InsuranceClaim | null;
  customer: CrmCustomer | null;
  sources: RagSourceSnapshot[];
  warnings: string[];
  answer: string;
  metrics: WorkflowMetrics;
}

export const BENCHMARK_DEFAULT_QUESTION =
  'For claim CLM-001, identify the customer, check the claim status, and explain which policy clauses may apply to the reported water damage.';

export function initialWorkflowState(
  claimId: string,
  question: string,
): WorkflowState {
  return {
    claimId,
    question,
    startedAtMs: Date.now(),
    claim: null,
    customer: null,
    sources: [],
    warnings: [],
    answer: '',
    metrics: {
      llmCalls: 0,
      mcpCalls: 0,
      embeddingCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  };
}

export interface WorkflowResponse {
  answer: string;
  sources: Omit<RagSourceSnapshot, 'content'>[];
  metrics: WorkflowMetrics;
  warnings: string[];
  claim: InsuranceClaim | null;
  customer: CrmCustomer | null;
}

export function toWorkflowResponse(state: WorkflowState): WorkflowResponse {
  return {
    answer: state.answer,
    sources: state.sources.map(({ content: _content, ...meta }) => meta),
    metrics: {
      ...state.metrics,
      durationMs: Math.max(0, Date.now() - state.startedAtMs),
    },
    warnings: state.warnings,
    claim: state.claim,
    customer: state.customer,
  };
}