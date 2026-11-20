import { Annotation } from '@langchain/langgraph';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { RagSource } from '../../rag/rag.types.js';
import type { ClaimLookupCustomer } from '../claim-lookup/claim-lookup.types.js';

import type { HumanDecision, ClaimReviewFinalStatus } from './claim-review.types.js';

export const ClaimReviewAnnotation = Annotation.Root({
  claimId: Annotation<string>,
  question: Annotation<string>,
  claim: Annotation<InsuranceClaim | null>,
  customer: Annotation<ClaimLookupCustomer | null>,
  sources: Annotation<RagSource[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  recommendation: Annotation<string>,
  humanDecision: Annotation<HumanDecision | null>,
  finalStatus: Annotation<ClaimReviewFinalStatus | null>,
  warnings: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  mcpCalls: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  llmCalls: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  inputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  outputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

export type ClaimReviewState = typeof ClaimReviewAnnotation.State;

export function initialClaimReviewState(
  claimId: string,
  question: string,
): ClaimReviewState {
  return {
    claimId,
    question,
    claim: null,
    customer: null,
    sources: [],
    recommendation: '',
    humanDecision: null,
    finalStatus: null,
    warnings: [],
    mcpCalls: 0,
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}