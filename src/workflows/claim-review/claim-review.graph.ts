import {
  Command,
  END,
  START,
  StateGraph,
  interrupt,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import type { ChatBedrockConverse } from '@langchain/aws';
import { z } from 'zod';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import type { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import type { DocumentChunkRow } from '../../rag/rag.types.js';

import {
  ClaimReviewAnnotation,
  type ClaimReviewState,
} from './claim-review.state.js';
import type { ClaimLookupCustomer } from '../claim-lookup/claim-lookup.types.js';
import type { ClaimReviewApprovalInterruptPayload } from './claim-review.types.js';

const CLAIM_STATUS_TOOL = 'claims_getClaimStatus';
const CUSTOMER_BY_POLICY_TOOL = 'crm_getCustomerByPolicy';
const DEFAULT_TOP_K = 5;

const humanDecisionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
});

const RECOMMENDATION_PROMPT = `You are assisting a human claims adjuster at ABC Assurances (fictional, educational).
Draft a recommendation for the adjuster: approve, deny, or request more information.
Use only the structured data and policy excerpts provided.
Cite stable source IDs like [SRC-001] when referencing policy language.
Clearly state this is a draft recommendation for human review — not a binding coverage determination.`;

export interface ClaimReviewGraphDependencies {
  invokeMcpTool: (
    toolName: string,
    input: Record<string, unknown>,
  ) => Promise<string>;
  embeddings: BedrockEmbeddingsService;
  retriever: DocumentRetrieverService;
  model: ChatBedrockConverse;
}

function parseJsonRecord<T>(raw: string): T | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value === null || typeof value !== 'object') {
      return null;
    }
    return value as T;
  } catch {
    return null;
  }
}

function assignSourceIds(chunks: DocumentChunkRow[]) {
  return chunks.map((chunk, index) => ({
    id: `SRC-${String(index + 1).padStart(3, '0')}`,
    ...chunk,
  }));
}

function buildRetrievalQuery(state: ClaimReviewState): string {
  const parts = [state.question];
  if (state.claim?.description) {
    parts.push(state.claim.description);
  }
  if (state.claim?.policyId) {
    parts.push(`Policy ${state.claim.policyId}`);
  }
  return parts.join(' ');
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('\n');
}

function readTokenUsage(response: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (typeof response !== 'object' || response === null) {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const meta = response as {
    usage_metadata?: { input_tokens?: number; output_tokens?: number };
    response_metadata?: Record<string, unknown>;
  };
  const usage =
    meta.usage_metadata ??
    (meta.response_metadata?.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined);
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

function routeAfterLoadClaim(state: ClaimReviewState): string {
  return state.claim ? 'loadCustomer' : 'failMissingClaim';
}

function routeAfterHumanDecision(state: ClaimReviewState): string {
  return state.humanDecision?.approved === true
    ? 'recordApproved'
    : 'recordRejected';
}

export function buildClaimReviewGraph(
  deps: ClaimReviewGraphDependencies,
  checkpointer: BaseCheckpointSaver,
) {
  async function loadClaim(state: ClaimReviewState) {
    const raw = await deps.invokeMcpTool(CLAIM_STATUS_TOOL, {
      claimId: state.claimId,
    });
    const claim = parseJsonRecord<InsuranceClaim>(raw);
    const warnings: string[] = [];
    if (!claim) {
      warnings.push(`No claim found for ID ${state.claimId}.`);
    }
    return { claim, warnings, mcpCalls: 1 };
  }

  async function loadCustomer(state: ClaimReviewState) {
    const policyId = state.claim?.policyId;
    if (!policyId) {
      return {
        customer: null as ClaimLookupCustomer | null,
        warnings: ['Skipping CRM lookup because the claim record is unavailable.'],
        mcpCalls: 0,
      };
    }
    const raw = await deps.invokeMcpTool(CUSTOMER_BY_POLICY_TOOL, { policyId });
    const customer = parseJsonRecord<ClaimLookupCustomer>(raw);
    const warnings: string[] = [];
    if (!customer) {
      warnings.push(`No CRM customer linked to policy ${policyId}.`);
    }
    return { customer, warnings, mcpCalls: 1 };
  }

  async function retrievePolicyClauses(state: ClaimReviewState) {
    const query = buildRetrievalQuery(state);
    const embedding = await deps.embeddings.embed(query);
    const chunks = await deps.retriever.searchGlobal(embedding, DEFAULT_TOP_K);
    const sources = assignSourceIds(chunks);
    const warnings: string[] = [];
    if (sources.length === 0) {
      warnings.push('No relevant policy clauses were retrieved.');
    }
    return { sources, warnings };
  }

  async function generateRecommendation(state: ClaimReviewState) {
    const context =
      state.sources.length === 0
        ? 'No policy excerpts were retrieved.'
        : state.sources
            .map(
              (source) =>
                `[${source.id}] ${source.documentName} v${source.documentVersion} p.${source.pageNumber}\n${source.content}`,
            )
            .join('\n\n---\n\n');

    const structured = JSON.stringify(
      {
        claim: state.claim,
        customer: state.customer,
        workflowWarnings: state.warnings,
      },
      null,
      2,
    );

    const response = await deps.model.invoke([
      { role: 'system', content: RECOMMENDATION_PROMPT },
      {
        role: 'user',
        content: `Adjuster question:\n${state.question}\n\nStructured data:\n${structured}\n\nPolicy excerpts:\n${context}`,
      },
    ]);

    const tokens = readTokenUsage(response);
    return {
      recommendation: extractTextContent(response.content),
      llmCalls: 1,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    };
  }

  function requestHumanApproval(state: ClaimReviewState) {
    const citations = state.sources.map((source) => ({
      id: source.id,
      documentName: source.documentName,
      documentVersion: source.documentVersion,
      pageNumber: source.pageNumber,
      chunkIndex: source.chunkIndex,
      similarity: source.similarity,
    }));

    const payload: ClaimReviewApprovalInterruptPayload = {
      kind: 'claim_review_approval',
      claimId: state.claimId,
      recommendation: state.recommendation,
      citations,
      disclaimer:
        'Educational simulation only. This is not a coverage determination and does not change claim data.',
    };

    const decision = interrupt(payload, { responseSchema: humanDecisionSchema });

    return { humanDecision: decision };
  }

  function recordApproved(state: ClaimReviewState) {
    return {
      finalStatus: 'approved' as const,
      warnings: [
        ...state.warnings,
        `Simulated approval recorded for ${state.claimId} (no claim data was modified).`,
      ],
    };
  }

  function recordRejected(state: ClaimReviewState) {
    return {
      finalStatus: 'rejected' as const,
      warnings: [
        ...state.warnings,
        `Simulated rejection recorded for ${state.claimId} (no claim data was modified).`,
      ],
    };
  }

  function failMissingClaim(state: ClaimReviewState) {
    return {
      finalStatus: 'failed' as const,
      warnings: [
        ...state.warnings,
        `Cannot request human approval without a claim record for ${state.claimId}.`,
      ],
    };
  }

  return new StateGraph(ClaimReviewAnnotation)
    .addNode('loadClaim', loadClaim)
    .addNode('loadCustomer', loadCustomer)
    .addNode('retrievePolicyClauses', retrievePolicyClauses)
    .addNode('generateRecommendation', generateRecommendation)
    .addNode('requestHumanApproval', requestHumanApproval)
    .addNode('recordApproved', recordApproved)
    .addNode('recordRejected', recordRejected)
    .addNode('failMissingClaim', failMissingClaim)
    .addEdge(START, 'loadClaim')
    .addConditionalEdges('loadClaim', routeAfterLoadClaim, {
      loadCustomer: 'loadCustomer',
      failMissingClaim: 'failMissingClaim',
    })
    .addEdge('loadCustomer', 'retrievePolicyClauses')
    .addEdge('retrievePolicyClauses', 'generateRecommendation')
    .addEdge('generateRecommendation', 'requestHumanApproval')
    .addConditionalEdges(
      'requestHumanApproval',
      routeAfterHumanDecision,
      {
        recordApproved: 'recordApproved',
        recordRejected: 'recordRejected',
      },
    )
    .addEdge('recordApproved', END)
    .addEdge('recordRejected', END)
    .addEdge('failMissingClaim', END)
    .compile({ checkpointer });
}

export type CompiledClaimReviewGraph = ReturnType<typeof buildClaimReviewGraph>;

export { Command };