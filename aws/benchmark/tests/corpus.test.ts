import { describe, expect, it } from 'vitest';

import {
  cosineSimilarity,
  searchCorpusChunks,
  type CorpusChunkRecord,
} from '../shared/src/corpus.js';
import {
  assignSourceIds,
  buildRetrievalQuery,
  retrievePolicyClausesFromCorpus,
} from '../shared/src/workflow-retrieval.js';
import { getClaimStatus } from '../shared/src/claims.js';

describe('corpus search', () => {
  const chunks: CorpusChunkRecord[] = [
    {
      id: '1',
      documentId: 'doc-a',
      documentName: 'Home Policy',
      documentVersion: '2024',
      pageNumber: 3,
      chunkIndex: 0,
      content: 'Water damage exclusion',
      embedding: [1, 0, 0],
    },
    {
      id: '2',
      documentId: 'doc-b',
      documentName: 'Auto Policy',
      documentVersion: '2024',
      pageNumber: 1,
      chunkIndex: 0,
      content: 'Collision coverage',
      embedding: [0, 1, 0],
    },
  ];

  it('ranks by cosine similarity', () => {
    const hits = searchCorpusChunks(chunks, [0.9, 0.1, 0], 2);
    expect(hits[0]?.chunk.id).toBe('1');
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it('builds retrieval query like Version B', () => {
    const claim = getClaimStatus('CLM-001');
    expect(claim).not.toBeNull();
    const query = buildRetrievalQuery(
      'water damage policy clauses',
      claim,
    );
    expect(query).toContain('water damage policy clauses');
    expect(query).toContain('Water damage');
    expect(query).toContain('POL-001');
  });

  it('assigns stable source ids', () => {
    const hits = searchCorpusChunks(chunks, [1, 0, 0], 1);
    const sources = assignSourceIds(hits);
    expect(sources[0]?.id).toBe('SRC-001');
    expect(sources[0]?.similarity).toBeGreaterThan(0);
  });

  it('retrievePolicyClausesFromCorpus warns on empty hits', () => {
    const { sources, warnings } = retrievePolicyClausesFromCorpus(
      chunks,
      [0, 0, 1],
      0,
    );
    expect(sources).toHaveLength(0);
    expect(warnings[0]).toMatch(/No relevant policy/);
  });
});