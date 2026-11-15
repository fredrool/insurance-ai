import { END, START, StateGraph } from '@langchain/langgraph';
import type { ChatBedrockConverse } from '@langchain/aws';

import type { InsuranceClaim } from '../../insurance/insurance.types.js';
import type { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import type { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import type { DocumentChunkRow } from '../../rag/rag.types.js';

import {
  ClaimLookupAnnotation,
  type ClaimLookupState,
} from './claim-lookup.state.js';
import type { ClaimLookupCustomer } from './claim-lookup.types.js';

const CLAIM_STATUS_TOOL = 'claims_getClaimStatus';
const CUSTOMER_BY_POLICY_TOOL = 'crm_getCustomerByPolicy';
const DEFAULT_TOP_K = 5;

const WORKFLOW_ANSWER_PROMPT = `You are a customer support agent for ABC Assurances (fictional, educational).
Answer the customer's question using only the structured data and policy excerpts provided.
Cite stable source IDs like [SRC-001] when using retrieved clauses.
If data is missing, explain what is unknown without inventing facts.`;

export interface ClaimLookupGraphDependencies {
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

function buildRetrievalQuery(state: ClaimLookupState): string {
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

export function buildClaimLookupGraph(deps: ClaimLookupGraphDependencies) {
  async function loadClaim(state: ClaimLookupState) {
    const raw = await deps.invokeMcpTool(CLAIM_STATUS_TOOL, {
      claimId: state.claimId,
    });
    const claim = parseJsonRecord<InsuranceClaim>(raw);

    const warnings: string[] = [];
    if (!claim) {
      warnings.push(`No claim found for ID ${state.claimId}.`);
    }

    return {
      claim,
      warnings,
      mcpCalls: 1,
    };
  }

  async function loadCustomer(state: ClaimLookupState) {
    const policyId = state.claim?.policyId;
    if (!policyId) {
      return {
        customer: null as ClaimLookupCustomer | null,
        warnings: state.claim
          ? []
          : ['Skipping CRM lookup because the claim record is unavailable.'],
        mcpCalls: 0,
      };
    }

    const raw = await deps.invokeMcpTool(CUSTOMER_BY_POLICY_TOOL, {
      policyId,
    });
    const customer = parseJsonRecord<ClaimLookupCustomer>(raw);
    const warnings: string[] = [];
    if (!customer) {
      warnings.push(`No CRM customer linked to policy ${policyId}.`);
    }

    return {
      customer,
      warnings,
      mcpCalls: 1,
    };
  }

  async function retrievePolicyClauses(state: ClaimLookupState) {
    const query = buildRetrievalQuery(state);
    const embedding = await deps.embeddings.embed(query);
    const chunks = await deps.retriever.searchGlobal(embedding, DEFAULT_TOP_K);
    const sources = assignSourceIds(chunks);
    const warnings: string[] = [];
    if (sources.length === 0) {
      warnings.push('No relevant policy clauses were retrieved.');
    }

    return {
      sources,
      warnings,
    };
  }

  async function generateAnswer(state: ClaimLookupState) {
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
      { role: 'system', content: WORKFLOW_ANSWER_PROMPT },
      {
        role: 'user',
        content: `Question:\n${state.question}\n\nStructured data:\n${structured}\n\nPolicy excerpts:\n${context}`,
      },
    ]);

    const tokens = readTokenUsage(response);
    return {
      answer: extractTextContent(response.content),
      llmCalls: 1,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    };
  }

  return new StateGraph(ClaimLookupAnnotation)
    .addNode('loadClaim', loadClaim)
    .addNode('loadCustomer', loadCustomer)
    .addNode('retrievePolicyClauses', retrievePolicyClauses)
    .addNode('generateAnswer', generateAnswer)
    .addEdge(START, 'loadClaim')
    .addEdge('loadClaim', 'loadCustomer')
    .addEdge('loadCustomer', 'retrievePolicyClauses')
    .addEdge('retrievePolicyClauses', 'generateAnswer')
    .addEdge('generateAnswer', END)
    .compile();
}

export type CompiledClaimLookupGraph = ReturnType<typeof buildClaimLookupGraph>;