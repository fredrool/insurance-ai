import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { RagSource } from '../../rag/rag.types.js';
import type { ClaimLookupCustomer } from '../claim-lookup/claim-lookup.types.js';
import type { AgentExecutionMetrics } from '../../agents/bedrock/agent-execution-metrics.js';

export interface ClaimReviewRequest {
  claimId: string;
  question: string;
}

export interface HumanDecision {
  approved: boolean;
  comment?: string;
}

export interface ClaimReviewResumeRequest {
  threadId: string;
  approved: boolean;
  comment?: string;
}

export type ClaimReviewFinalStatus =
  | 'approved'
  | 'rejected'
  | 'failed';

export interface ClaimReviewSourceSummary {
  id: string;
  documentName: string;
  documentVersion: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
}

export interface ClaimReviewAwaitingResponse {
  status: 'awaiting_approval';
  threadId: string;
  claimId: string;
  recommendation: string;
  sources: ClaimReviewSourceSummary[];
  warnings: string[];
  claim: InsuranceClaim | null;
  customer: ClaimLookupCustomer | null;
  metrics: AgentExecutionMetrics;
}

export interface ClaimReviewCompletedResponse {
  status: 'completed';
  claimId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  simulated: true;
  finalStatus: ClaimReviewFinalStatus;
  recommendation: string;
  warnings: string[];
  metrics: AgentExecutionMetrics;
}

export interface ClaimReviewFailedResponse {
  status: 'failed';
  claimId: string;
  threadId: string;
  warnings: string[];
  metrics: AgentExecutionMetrics;
}

export type ClaimReviewStartResponse =
  | ClaimReviewAwaitingResponse
  | ClaimReviewFailedResponse;

export type ClaimReviewResumeResponse = ClaimReviewCompletedResponse;

export interface ClaimReviewApprovalInterruptPayload {
  kind: 'claim_review_approval';
  claimId: string;
  recommendation: string;
  citations: ClaimReviewSourceSummary[];
  disclaimer: string;
}

export type ClaimReviewStateSnapshot = {
  claimId: string;
  question: string;
  claim: InsuranceClaim | null;
  customer: ClaimLookupCustomer | null;
  sources: RagSource[];
  recommendation: string;
  humanDecision: HumanDecision | null;
  finalStatus: ClaimReviewFinalStatus | null;
  warnings: string[];
  mcpCalls: number;
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
};