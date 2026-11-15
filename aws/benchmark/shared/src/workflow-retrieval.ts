import type { InsuranceClaim } from './claims.js';
import type { CorpusChunkRecord } from './corpus.js';
import {
  DEFAULT_TOP_K,
  searchCorpusChunks,
} from './corpus.js';
import type { RagSourceSnapshot } from './workflow-state.js';

export function buildRetrievalQuery(
  question: string,
  claim: InsuranceClaim | null,
): string {
  const parts = [question];
  if (claim?.description) {
    parts.push(claim.description);
  }
  if (claim?.policyId) {
    parts.push(`Policy ${claim.policyId}`);
  }
  return parts.join(' ');
}

export function assignSourceIds(
  hits: { chunk: CorpusChunkRecord; similarity: number }[],
): RagSourceSnapshot[] {
  return hits.map(({ chunk, similarity }, index) => ({
    id: `SRC-${String(index + 1).padStart(3, '0')}`,
    documentName: chunk.documentName,
    documentVersion: chunk.documentVersion,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarity,
    content: chunk.content,
  }));
}

export function retrievePolicyClausesFromCorpus(
  chunks: CorpusChunkRecord[],
  queryEmbedding: number[],
  topK = DEFAULT_TOP_K,
): { sources: RagSourceSnapshot[]; warnings: string[] } {
  const hits = searchCorpusChunks(chunks, queryEmbedding, topK);
  const sources = assignSourceIds(hits);
  const warnings: string[] = [];
  if (sources.length === 0) {
    warnings.push('No relevant policy clauses were retrieved.');
  }
  return { sources, warnings };
}