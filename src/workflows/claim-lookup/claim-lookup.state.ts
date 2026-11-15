import { Annotation } from '@langchain/langgraph';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { RagSource } from '../../rag/rag.types.js';
import type { ClaimLookupCustomer } from './claim-lookup.types.js';

export const ClaimLookupAnnotation = Annotation.Root({
  claimId: Annotation<string>,
  question: Annotation<string>,
  claim: Annotation<InsuranceClaim | null>,
  customer: Annotation<ClaimLookupCustomer | null>,
  sources: Annotation<RagSource[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  warnings: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  answer: Annotation<string>,
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

export type ClaimLookupState = typeof ClaimLookupAnnotation.State;