import { tool } from 'langchain';
import { z } from 'zod';

import { BedrockEmbeddingsService } from '../../rag/embeddings/bedrock-embeddings.service.js';
import { DocumentRetrieverService } from '../../rag/retrieval/document-retriever.service.js';
import { InsuranceService } from '../../insurance/insurance.service.js';
import type { DocumentChunkRow } from '../../rag/rag.types.js';

const DEFAULT_GLOBAL_TOP_K = 5;
const DEFAULT_PER_DOCUMENT_TOP_K = 3;

export interface RagToolDependencies {
  embeddings: BedrockEmbeddingsService;
  retriever: DocumentRetrieverService;
}

export function createInsuranceTools(
  insuranceService: InsuranceService,
  rag?: RagToolDependencies,
) {
  const getClaimStatus = tool(
    async ({ claimId }) =>
      JSON.stringify(insuranceService.getClaimStatus(claimId)),
    {
      name: 'getClaimStatus',
      description: 'Retrieve the status of an insurance claim.',
      schema: z.object({
        claimId: z.string(),
      }),
    },
  );

  const getPolicyDetails = tool(
    async ({ policyId }) =>
      JSON.stringify(insuranceService.getPolicyDetails(policyId)),
    {
      name: 'getPolicyDetails',
      description: 'Retrieve details of an insurance policy.',
      schema: z.object({
        policyId: z.string(),
      }),
    },
  );

  if (!rag) {
    return [getClaimStatus, getPolicyDetails];
  }

  const searchInsuranceDocuments = tool(
      async ({ query, documentNames, topK }) => {
        const embedding = await rag.embeddings.embed(query);

        const chunks: DocumentChunkRow[] =
          documentNames && documentNames.length > 0
            ? await rag.retriever.searchByDocuments(
                embedding,
                documentNames,
                topK ?? DEFAULT_PER_DOCUMENT_TOP_K,
              )
            : await rag.retriever.searchGlobal(
                embedding,
                topK ?? DEFAULT_GLOBAL_TOP_K,
              );

        return JSON.stringify({
          query,
          sources: assignSourceIds(chunks),
        });
      },
      {
        name: 'searchInsuranceDocuments',
        description:
          'Search fictional ABC Assurances policy documents by semantic similarity. Returns passages and source metadata as JSON only (no generated answer).',
        schema: z.object({
          query: z.string().min(1).describe('Search query in natural language'),
          documentNames: z
            .array(z.string())
            .optional()
            .describe(
              'Optional PDF document names. If omitted, search globally across all indexed documents.',
            ),
          topK: z
            .number()
            .int()
            .positive()
            .max(20)
            .optional()
            .describe(
              'Maximum results globally, or per document when documentNames is set.',
            ),
        }),
      },
    );

  return [getClaimStatus, getPolicyDetails, searchInsuranceDocuments];
}

function assignSourceIds(chunks: DocumentChunkRow[]) {
  return chunks.map((chunk, index) => ({
    id: `SRC-${String(index + 1).padStart(3, '0')}`,
    documentName: chunk.documentName,
    documentVersion: chunk.documentVersion,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    content: chunk.content,
  }));
}
