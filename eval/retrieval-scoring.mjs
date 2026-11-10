/**
 * @param {Array<{ document_name: string, content: string }>} results
 * @param {string[]} expectedDocuments
 * @param {number} k
 */
export function documentRecallAtK(results, expectedDocuments, k) {
  const top = results.slice(0, k);
  const foundDocuments = new Set(top.map((row) => row.document_name));
  const hits = expectedDocuments.filter((name) => foundDocuments.has(name));
  const missing = expectedDocuments.filter((name) => !foundDocuments.has(name));

  return {
    score:
      expectedDocuments.length === 0
        ? 1
        : hits.length / expectedDocuments.length,
    hits,
    missing,
  };
}

/**
 * @param {Array<{ content: string }>} results
 * @param {string[]} patterns
 * @param {number} k
 */
export function clauseRecallAtK(results, patterns, k) {
  const top = results.slice(0, k);
  const corpus = top.map((row) => row.content).join('\n');
  const hits = [];
  const missing = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(corpus)) {
      hits.push(pattern);
    } else {
      missing.push(pattern);
    }
  }

  return {
    score: patterns.length === 0 ? 1 : hits.length / patterns.length,
    hits,
    missing,
  };
}

/**
 * @param {{
 *   id: string;
 *   expectRelevantEvidence: boolean;
 *   expectedDocuments?: string[];
 *   requiredClausePatterns?: string[];
 *   topK?: number;
 * }} testCase
 * @param {Array<{ document_name: string, content: string, page_number: number, chunk_index: number, similarity: number }>} results
 */
export function scoreRetrievalCase(testCase, results) {
  const k = testCase.topK ?? 5;

  if (!testCase.expectRelevantEvidence) {
    return {
      id: testCase.id,
      scored: false,
      topResults: summarizeResults(results, k),
    };
  }

  const documentRecall = documentRecallAtK(
    results,
    testCase.expectedDocuments ?? [],
    k,
  );
  const clauseRecall = clauseRecallAtK(
    results,
    testCase.requiredClausePatterns ?? [],
    k,
  );

  const passed =
    documentRecall.score === 1 && clauseRecall.score === 1;

  return {
    id: testCase.id,
    scored: true,
    passed,
    k,
    documentRecall,
    clauseRecall,
    topResults: summarizeResults(results, k),
  };
}

function summarizeResults(results, k) {
  return results.slice(0, k).map((row, index) => ({
    rank: index + 1,
    documentName: row.document_name,
    pageNumber: row.page_number,
    chunkIndex: row.chunk_index,
    similarity: Number(row.similarity),
    excerpt: row.content.slice(0, 160).replace(/\s+/g, ' '),
  }));
}

export function aggregateScoredCases(caseReports) {
  const scored = caseReports.filter((report) => report.scored);

  if (!scored.length) {
    return {
      caseCount: 0,
      meanDocumentRecallAt5: 0,
      meanClauseRecallAt5: 0,
    };
  }

  const meanDocumentRecallAt5 =
    scored.reduce((sum, report) => sum + report.documentRecall.score, 0) /
    scored.length;
  const meanClauseRecallAt5 =
    scored.reduce((sum, report) => sum + report.clauseRecall.score, 0) /
    scored.length;

  return {
    caseCount: scored.length,
    meanDocumentRecallAt5,
    meanClauseRecallAt5,
  };
}
