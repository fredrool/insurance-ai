import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { RagSource } from '../../rag/rag.types.js';

export interface ClaimLookupRequest {
  claimId: string;
  question: string;
}

export interface ClaimLookupCustomer {
  id: string;
  displayName: string;
  email: string;
  policyIds: string[];
}

export interface ClaimLookupExecutionMetrics {
  durationMs: number;
  llmCalls: number;
  mcpCalls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ClaimLookupResponse {
  answer: string;
  sources: RagSource[];
  metrics: ClaimLookupExecutionMetrics;
  warnings: string[];
  claim: InsuranceClaim | null;
  customer: ClaimLookupCustomer | null;
}