import { describe, expect, it } from 'vitest';

import {
  aggregateScoredCases,
  clauseRecallAtK,
  documentRecallAtK,
  scoreRetrievalCase,
} from './retrieval-scoring.mjs';

describe('retrieval-scoring', () => {
  const sampleResults = [
    {
      document_name: 'home-insurance.pdf',
      page_number: 5,
      chunk_index: 2,
      similarity: 0.91,
      content: '5.3.1 Foundation infiltration exclusion applies.',
    },
    {
      document_name: 'claims-procedure.pdf',
      page_number: 3,
      chunk_index: 4,
      similarity: 0.82,
      content: 'Engineering report ER-FND within 15 days for 5.3.3.',
    },
  ];

  it('computes document and clause recall at k', () => {
    const doc = documentRecallAtK(
      sampleResults,
      ['home-insurance.pdf', 'claims-procedure.pdf'],
      5,
    );
    const clause = clauseRecallAtK(sampleResults, ['5\\.3\\.1', 'ER-FND'], 5);

    expect(doc.score).toBe(1);
    expect(clause.score).toBe(1);
  });

  it('marks unsupported cases as unscored', () => {
    const report = scoreRetrievalCase(
      {
        id: 'vet',
        expectRelevantEvidence: false,
        topK: 5,
      },
      sampleResults,
    );

    expect(report.scored).toBe(false);
    expect(report.topResults).toHaveLength(2);
  });

  it('aggregates only scored cases', () => {
    const aggregate = aggregateScoredCases([
      {
        id: 'a',
        scored: true,
        passed: true,
        documentRecall: { score: 1 },
        clauseRecall: { score: 0.5 },
      },
      {
        id: 'b',
        scored: true,
        passed: false,
        documentRecall: { score: 0.5 },
        clauseRecall: { score: 1 },
      },
      { id: 'c', scored: false },
    ]);

    expect(aggregate.caseCount).toBe(2);
    expect(aggregate.meanDocumentRecallAt5).toBe(0.75);
    expect(aggregate.meanClauseRecallAt5).toBe(0.75);
  });
});
